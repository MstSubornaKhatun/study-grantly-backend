const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');



require('dotenv').config();


const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);



const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mongo URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.honlggm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Global collections (DO NOT redeclare inside run)
let scholarshipCollection;
let applicationCollection;
let usersCollection;
let reviewCollection;

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    const db = client.db('scholarDB');

    // Assign to global variables (NO const)
    scholarshipCollection = db.collection('scholarships');
    applicationCollection = db.collection('applications');
    usersCollection = db.collection('users');
    reviewCollection = db.collection('reviews');
    paymentsCollection = db.collection('payments');


    // -----------------------
    // ✅ SCHOLARSHIP ROUTES
    // -----------------------

    app.get('/scholarships', async (req, res) => {
      const result = await scholarshipCollection.find().toArray();
      res.send(result);
    });

    app.get('/scholarships/:id', async (req, res) => {
      const id = req.params.id;
      const result = await scholarshipCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post('/scholarships', async (req, res) => {
      const data = req.body;
      const result = await scholarshipCollection.insertOne(data);
      res.send(result);
    });

    app.delete('/scholarships/:id', async (req, res) => {
      const id = req.params.id;
      const result = await scholarshipCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // -----------------------
    // ✅ APPLICATION ROUTES
    // -----------------------

    app.post('/applications', async (req, res) => {
      const data = req.body;
      const result = await applicationCollection.insertOne(data);
      res.send(result);
    });

    app.get('/applications', async (req, res) => {
      const email = req.query.email;
      if (email) {
        const result = await applicationCollection.find({ userEmail: email }).toArray();
        res.send(result);
      } else {
        const result = await applicationCollection.find().toArray();
        res.send(result);
      }
    });

    app.delete('/applications/:id', async (req, res) => {
      const id = req.params.id;
      const result = await applicationCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch('/applications/cancel/:id', async (req, res) => {
      const id = req.params.id;
      const result = await applicationCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'cancelled' } }
      );
      res.send(result);
    });

    // -----------------------
    // ✅ REVIEW ROUTES
    // -----------------------

    app.post('/reviews', async (req, res) => {
      const data = req.body;
      const result = await reviewCollection.insertOne(data);
      res.send(result);
    });

    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get('/reviews/:scholarshipId', async (req, res) => {
      const scholarshipId = req.params.scholarshipId;
      const result = await reviewCollection.find({ scholarshipId }).toArray();
      res.send(result);
    });

    app.delete('/reviews/:id', async (req, res) => {
      const id = req.params.id;
      const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // -----------------------
    // ✅ USER ROUTES
    // -----------------------

    app.post('/users', async (req, res) => {
      const user = req.body;
      const existing = await usersCollection.findOne({ email: user.email });
      if (existing) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role || 'user' });
    });

    app.patch('/users/role/:id', async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      res.send(result);
    });

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });


    //Payment
    app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amountInCents } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, // e.g., 5000 for $50.00
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("❌ Failed to create payment intent:", error);
    res.status(500).send({ message: "Failed to create payment intent" });
  }
});










app.post('/payments', async (req, res) => {
  try {
    const {
      scholarshipId,
      userEmail,
      amount,
      transactionId,
      paymentMethod,
      paidAt = new Date()
    } = req.body;

    const paymentDoc = {
      scholarshipId,
      userEmail,
      amount,
      transactionId,
      paymentMethod,
      paidAt: new Date(paidAt),
      paidAtString: new Date(paidAt).toISOString(),
      type: 'scholarship'
    };

    const result = await paymentsCollection.insertOne(paymentDoc);

    res.status(201).send({
      message: "✅ Payment recorded successfully",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error("❌ Error recording scholarship payment:", error);
    res.status(500).send({ message: "Failed to record payment" });
  }
});





    app.get('/payments', async (req, res) => {
  try {
    const userEmail = req.query.email;

    const query = userEmail ? { userEmail } : {};
    const options = { sort: { paidAt: -1 } }; // Latest payments first

    const payments = await paymentsCollection.find(query, options).toArray();
    res.send(payments);
  } catch (error) {
    console.error("❌ Error fetching payments:", error);
    res.status(500).send({ message: "Failed to fetch payment history" });
  }
});



















    // -----------------------
    // ✅ PING TEST
    // -----------------------

    await client.db("admin").command({ ping: 1 });
    console.log("✅ Pinged your deployment. Successfully connected to MongoDB.");

  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
  }
}

run().catch(console.dir);

// -----------------------
// ✅ BASIC ROUTE
// -----------------------
app.get('/', (req, res) => {
  res.send('🎓 Scholarship Management System Server is Running');
});

// -----------------------
// ✅ START SERVER
// -----------------------
app.listen(port, () => {
  console.log( `Server running on port ${port}`);
});