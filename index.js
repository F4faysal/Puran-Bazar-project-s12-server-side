const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
var jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
// This is your test secret API key.
const stripe = require("stripe")(process.env.SK_PAYMENT);
const app = express();
// middlewares
app.use(cors());
app.use(express.json());

// Database Connection
const uri = process.env.DB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
/**=======================================
                verifyJWT
  =====================================*/

function verifyJWT(req, res, next) {
  console.log("varifay", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    /**=======================================
                     mongodb start 
      ======================================*/
    const categoryCollection = client.db("puranbazar").collection("category");
    const usersCollection = client.db("puranbazar").collection("users");
    const bookingsCollection = client.db("puranbazar").collection("bookings");
    const productsCollection = client.db("puranbazar").collection("products");
    const paymentsCollection = client.db("puranbazar").collection("payments");
    /**=======================================
                       mongodb End 
      ======================================*/

    /**=======================================
               verifyAdmin
  =====================================*/
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    /**=======================================
               verifySeller
  =====================================*/
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.accountType !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //-------------------------------------------------------------------------------------
    /**=======================================
                update a admin role
      =======================================*/

    app.put("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);

      console.log(result);
    });

    app.put("/user/active/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: "verify",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
      console.log(result);
    });

    /**=======================================
                Put USERS api 
      =======================================*/
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      console.log("result ", result);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      // console.log("token ", token, user);
      res.send({ result, token });
    });

    /**=======================================
                get USERS api 
      =======================================*/

    app.get("/users/user", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { accountType: "user" };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    app.get("/users/seller", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { accountType: "seller" };
      const seller = await usersCollection.find(query).toArray();
      res.send(seller);
    });
    app.get("/users/seller/active", async (req, res) => {
      const query = { accountType: "seller", status: "verify" };
      const seller = await usersCollection.find(query).toArray();
      res.send(seller);
    });
    //users/user
    /**=======================================
                Delet USERS api 
      =======================================*/
    app.delete("/users/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
    app.delete(
      "/users/seller/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const result = await usersCollection.deleteOne(filter);
        res.send(result);
      }
    );
    /**=======================================
                get api categories
      =======================================*/
    app.get("/categories", async (req, res) => {
      const query = {};
      const tocken = req.headers.authorization;
      console.log("varifay tokcen get", tocken);
      const cursor = categoryCollection.find(query);
      const categories = await cursor.toArray();
      res.send(categories);
    });

    app.get("/categories/:slug", verifyJWT, async (req, res) => {
      const slug = req.params.slug;
      const query = { slug: slug };
      const categorie = await categoryCollection.findOne(query);
      res.send(categorie);
    });

    /**=======================================
                  get ptodats api 
      =======================================*/
    app.get("/products/:name", verifyJWT, async (req, res) => {
      const category = req.params.name;
      const query = { product_category_id: category, status: "available" };
      // console.log(category, query);
      // const tocken = req.headers.authorization;
      const products = await productsCollection.find(query).toArray();
      // console.log(products);
      // console.log("varifay tokcen get", products);
      res.send(products);
    });

    /**=======================================
              get advatices ptodats api 
      =======================================*/

    app.get("/advatices/:email", verifyJWT, verifySeller, async (req, res) => {
      const email = req.params.email;
      const query = { status: "available", seller: email };
      // console.log(category, query);
      const products = await productsCollection.find(query).toArray();
      console.log(products);
      res.send(products);
    });

    /**=======================================
                get seller ptodats api 
      =======================================*/
    app.get("/product/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { seller: email };
      const sellerpodact = await productsCollection.find(query).toArray();
      res.send(sellerpodact);
    });
    /**=======================================
           put ptodats for delar seller api 
      =======================================*/

    app.put("/product/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: { status: "available" },
      };
      const result = await productsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      // console.log("token ", token, user);
      console.log(result);
      res.send(result);
    });

    /**=======================================
              Delete seller ptodats api 
      =======================================*/
    app.delete("/product/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    });
    /**=======================================
                  POST ptodats api 
      =======================================*/

    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const addProduct = req.body;
      const result = await productsCollection.insertOne(addProduct);
      res.send(result);
    });

    /**=======================================
              bookings post ptodats api 
      =======================================*/

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        bookingDate: booking.bookingDate,
        email: booking.email,
        title: booking.title,
      };

      console.log(query);
      const alreadyBooked = await bookingsCollection.find(query).toArray();

      if (alreadyBooked.length) {
        const message = `You have already booked ${booking.title}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    /**=======================================
              bookings get ptodats api 
      =======================================*/

    app.get("/bookings/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const sellerpodact = await bookingsCollection.find(query).toArray();
      res.send(sellerpodact);
    });
    /**=======================================
      bookings Delete seller ptodats api 
    =======================================*/
    app.delete("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    /**=======================================
            bookings Payment ptodats api 
      =======================================*/

    app.get("/bookings/pay/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    });

    /**=======================================
             paymant ptodats api 
  =======================================*/

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booking = req.body;
      const price = booking.sell_price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // --------paymant-----------
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          payment_detals: payment,
        },
      };
      const updatedResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });
    /**=======================================
            Admin and Sellar ptodats api 
      =======================================*/

    app.get("/users/account-type/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.accountType === "seller" });
    });

    app.get("/users/account-admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });
  } finally {
  }
}

run().catch((err) => console.error(err));

app.get("/", async (req, res) => {
  res.send("Puran bazar server  is running ....");
});

app.listen(port, () => console.log(`Puran bazar running on ${port}`));
