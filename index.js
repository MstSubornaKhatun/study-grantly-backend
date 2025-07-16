const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");


require('dotenv').config();


const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());




const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedKey);
// const serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
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
let applicationsCollection;
let usersCollection;
let reviewCollection;

async function run() {
  try {
    // Connect to MongoDB
    // await client.connect();
    const db = client.db('scholarDB');

    // Assign to global variables (NO const)
    scholarshipCollection = db.collection('scholarships');
    applicationsCollection = db.collection('applications');
    usersCollection = db.collection('users');
    reviewCollection = db.collection('reviews');
    paymentsCollection = db.collection('payments');







    
     // custom middlewares
        const verifyFBToken = async (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            // verify the token
            try {
                const decoded = await admin.auth().verifyIdToken(token);
                req.decoded = decoded;
                next();
            }
            catch (error) {
                return res.status(403).send({ message: 'forbidden access' })
            }
        }



    // users
app.post('/users', async (req, res) => {
  const email = req.body.email;
  const userExists = await usersCollection.findOne({ email });
  if (userExists) {
    return res.status(200).send({ message: 'User already exists', inserted: false });
  }
  const user = req.body;
  const result = await usersCollection.insertOne(user);
  res.send(result);
});





app.get('/users/:email/role', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const user = await usersCollection.findOne({ email });

    if (user?.role) {
      res.send({ role: user.role });
    } else {
      res.send({ role: 'user' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Internal server error' });
  }
});


app.get('/users', verifyFBToken, async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ error: 'Internal server error' });
  }
});



app.patch('/users/role/:id', verifyFBToken, async (req, res) => {
  const id = req.params.id;
  const { role } = req.body;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = { $set: { role } };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.delete('/users/:id', verifyFBToken, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const result = await usersCollection.deleteOne(filter);
  res.send(result);
});


// SCHOLARSHIP ROUTES

// CREATE
app.post('/scholarships',  async (req, res) => {
  const data = req.body;
  try {
    const result = await scholarshipCollection.insertOne(data);
    if (result.insertedId) {
      return res.status(201).send({ insertedId: result.insertedId });
    }
    res.status(500).send({ error: "Failed to add scholarship" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// READ ALL
app.get('/scholarships', async (req, res) => {
  try {
    const result = await scholarshipCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// READ ONE
app.get('/scholarships/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await scholarshipCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// DELETE
app.delete('/scholarships/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await scholarshipCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

//  UPDATE (you need to add this one)
app.put('/scholarships/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    const result = await scholarshipCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});



    
    //  APPLICATIONs ROUTES
    

    

    app.post('/applications', async (req, res) => {
      const data = req.body;
      const result = await applicationsCollection.insertOne(data);
      res.send(result);
    });

        // applications api
        // GET: All applications OR applications by user (created_by), sorted by latest
        app.get('/applications', verifyFBToken, async (req, res) => {
            try {
                const userEmail = req.query.email;

                const query = userEmail ? { created_by: userEmail } : {};
                const options = {
                    sort: { createdAt: -1 }, // Newest first
                };

                const applications = await applicationsCollection.find(query, options).toArray();
                res.send(applications);
            } catch (error) {
                console.error('Error fetching applications:', error);
                res.status(500).send({ message: 'Failed to get applications' });
            }
        });



    // my applications
    app.get('/applications/user/:email', async (req, res) => {
      const email = req.params.email;
      const result = await applicationsCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });


    // already apply 
    // Example (Express + MongoDB)
    app.get("/applications/check", async (req, res) => {
      const { email, scholarshipId } = req.query;

      const exists = await applicationsCollection.findOne({ userEmail: email, scholarshipId });
      res.send({ alreadyApplied: !!exists });
    });







    app.get('/applications', async (req, res) => {
      const email = req.query.email;
      if (email) {
        const result = await applicationsCollection.find({ userEmail: email }).toArray();
        res.send(result);
      } else {
        const result = await applicationsCollection.find().toArray();
        res.send(result);
      }
    });

    app.delete('/applications/:id', async (req, res) => {
      const id = req.params.id;
      const result = await applicationsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });



app.patch('/applications/cancel/:id', async (req, res) => {
  const id = req.params.id;
  const result = await applicationsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'cancelled' } }
  );
  res.send(result);
});


//  Admin or Moderator updates application status
app.patch('/applications/status/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body; // should be 'approved' | 'rejected' | etc.

  try {
    const result = await applicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount > 0) {
      res.send({ success: true, message: 'Status updated successfully' });
    } else {
      res.status(404).send({ success: false, message: 'Application not found or no change made' });
    }
  } catch (error) {
    res.status(500).send({ success: false, message: 'Server error' });
  }
});




    // Update a single application by ID
    app.put("/applications/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { phone, address, gender, degree } = req.body;

        const updateDoc = {
          $set: {
            phone,
            address,
            gender,
            degree,
            updatedAt: new Date(), // optional, for tracking edits
          },
        };

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Application updated successfully" });
        } else {
          res.status(404).send({ success: false, message: "No changes made or application not found" });
        }
      } catch (error) {
        console.error("Error updating application:", error.message);
        res.status(500).send({ success: false, message: "Server Error" });
      }
    });





    //  Create Review
    app.post('/reviews', async (req, res) => {
       const data = req.body; 
      const result = await reviewCollection.insertOne(data); 
      res.send(result); });

    //  Get All Reviews 
    app.get('/reviews', verifyFBToken, async (req, res) => { 
      const result = await reviewCollection.find().toArray(); 
      res.send(result); 
    });

    //  Get Reviews by Scholarship ID
    app.get('/reviews/:scholarshipId', async (req, res) => {
       const scholarshipId = req.params.scholarshipId; 
       const result = await reviewCollection.find({ scholarshipId }).toArray(); res.send(result); 
      });

    //  Get Reviews by User Email 
    app.get('/reviews/user/:email', async (req, res) => { 
      const email = req.params.email;
       const result = await reviewCollection.find({ userEmail: email }).toArray(); res.send(result);
       });

    //  Delete Review 
    app.delete('/reviews/:id', async (req, res) => {
       const id = req.params.id; const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result); });

    //  Edit/Update Review 
    app.patch('/reviews/:id', async (req, res) => {
      const reviewId = req.params.id; 
      const updatedReview = req.body;

      try { const result = await reviewCollection.updateOne({ _id: new ObjectId(reviewId) }, 
      { $set: updatedReview });
       res.send(result);
     } catch (error) { 
      console.error("Failed to update review:", error);
       res.status(500).send({ error: "Failed to update review"

        }); }
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
          message: " Payment recorded successfully",
          insertedId: result.insertedId,
        });

      } catch (error) {
        console.error("❌ Error recording scholarship payment:", error);
        res.status(500).send({ message: "Failed to record payment" });
      }
    });





    app.get('/payments', verifyFBToken, async (req, res) => {
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



















    
    //  PING TEST
    

    // await client.db("admin").command({ ping: 1 });
    // console.log(" Pinged your deployment. Successfully connected to MongoDB.");

  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
  }
}

run().catch(console.dir);


//  BASIC ROUTE

app.get('/', (req, res) => {
  res.send('🎓 Scholarship Management System Server is Running');
});


// START SERVER

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});