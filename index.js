const express = require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000;

const admin = require("firebase-admin");

const serviceAccount = require("./money-map-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// MiddleWare
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mcccn4v.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const VerifyFirebaseToken = async (req, res, next) => {
    // console.log("in the verify middleware", req.headers.authorization)
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    const token = req.headers.authorization.split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: "Unauthorized access" })

    }
    try {
        const userInfo = await admin.auth().verifyIdToken(token);
        req.token_email = userInfo.email;
        console.log("after token validation", userInfo)
        next()

    }
    catch {
        return res.status(401).send({ message: "Unauthorized access" })
    }
}

app.get('/', (req, res) => {
    res.send('Money Map is running on server')
})

async function run() {
    try {
        // await client.connect();
        const database = client.db("Money_Map")
        const TransactionCollection = database.collection("transactions")
        const UsersCollection = database.collection("Users")
        const UserStatsCollection = database.collection("userStats");


        // User Related API
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            // Check is the email exist on DB
            const email = req.body.email;
            const query = { email: email }
            const existingUser = await UsersCollection.findOne(query);
            if (existingUser) {
                res.send({ message: "User already exist" })
            }
            else {
                const result = await UsersCollection.insertOne(newUser)
                res.send(result);
            }
        })

        // Transaction related API

        // Heard
    
        app.get('/transactions', VerifyFirebaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                const { limit, skip, sort = "date", order = "desc" } = req.query;

                // Email check
                if (email) {
                    if (email !== req.token_email) {
                        return res.status(403).send({ message: "Forbidden Access" });
                    }
                }

                // Build query
                const query = email ? { email } : {};

                // Sorting option
                const sortOption = {};
                sortOption[sort] = order === "asc" ? 1 : -1;

                // Fetch data
                const transactions = await TransactionCollection
                    .find(query)
                    .sort(sortOption)
                    .limit(Number(limit))
                    .skip(Number(skip))
                    .toArray();

                // Total count
                const total = await TransactionCollection.countDocuments(query);

                res.send({ transactions, total });

            } catch (error) {
                console.error(error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // Heard 

        app.get('/transactions/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await TransactionCollection.findOne(query);
            res.send(result)
        })

        app.post('/transactions', VerifyFirebaseToken, async (req, res) => {
            // console.log("Hey",req.headers)
            const newTransaction = req.body;
            const result = await TransactionCollection.insertOne(newTransaction)
            console.log(result)
            res.send(result);
        })

        app.delete('/transactions/:id', VerifyFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await TransactionCollection.deleteOne(query);
            console.log("result",result)
            res.send(result)
        })

        // Update a transaction by ID
        app.put('/transactions/update/:id', VerifyFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;

            try {
                const query = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        type: updatedData.type,
                        category: updatedData.category,
                        amount: updatedData.amount,
                        description: updatedData.description,
                        date: updatedData.date,
                    },
                };

                const result = await TransactionCollection.updateOne(query, updateDoc);

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: "No transaction found or no changes made" });
                }

                res.send({ message: "Transaction updated successfully", result });
            } catch (error) {
                console.error("Update error:", error);
                res.status(500).send({ message: "Failed to update transaction", error: error.message });
            }
        });

        //  OVERVIEW API (Total Income, Expense & Balance)
        // Help from CHAT GPT 

        app.get('/overview', VerifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: "Email is required" });
            }

            if (email !== req.token_email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }

            const query = { email };

            const allTransactions = await TransactionCollection.find(query).toArray();

            let totalIncome = 0;
            let totalExpense = 0;

            allTransactions.forEach(t => {
                const amount = Number(t.amount) || 0;
                if (t.type === "Income") totalIncome += amount;
                else if (t.type === "Expense") totalExpense += amount;
            });

            const balance = totalIncome - totalExpense;

            res.send({
                email,
                totalIncome,
                totalExpense,
                balance
            });
        });

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
