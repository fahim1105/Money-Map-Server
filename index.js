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

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mcccn4v.mongodb.net/Money_Map?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mcccn4v.mongodb.net/?appName=Cluster0`;

// 103.96.69.121/32

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const logger = (req, res, next) => {
    console.log("Login information")
    next()
}
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
        await client.connect();
        const database = client.db("Money_Map")
        const TransactionCollection = database.collection("transactions")
        const UsersCollection = database.collection("Users")

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
        app.get('/transactions', VerifyFirebaseToken, async (req, res) => {
            // console.log(req.headers)
            const email = req.query.email;
            const query = {};
            if (email) {
                if (email !== req.token_email) {
                    return res.status(403).send({ message: "Forbidden Access" })
                }
                query.email = email;
            }
            const cursor = TransactionCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

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

        app.delete('/transactions/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await TransactionCollection.deleteOne(query);
            res.send(result)
        })

        // Update a transaction by ID
        app.put('/transactions/update/:id', async (req, res) => {
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

            // hbjnkm
            // gvhjbnm
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
