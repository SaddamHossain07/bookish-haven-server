const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000


// middleware ============================
// Enable All CORS Requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    // other headers...
    next();
});

app.use(cors({
    origin: [
        'https://bookishhaven-fdd6d.web.app',
        'https://bookishhaven-fdd6d.firebaseapp.com',
        'http://localhost:5173'
    ],
    credentials: true
}));
app.use(express.json())
app.use(cookieParser())

// token verification middleware ================
const verifyToken = async (req, res, next) => {
    const token = req.cookies.token
    console.log('middleware token', token)
    if (!token) {
        return res.status(401).send({ message: 'not authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorized' })
        }
        console.log('value in the token decoded', decoded)
        req.user = decoded
        next()

    })
}




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = "mongodb+srv://<username>:<password>@cluster0.0db2mvq.mongodb.net/?retryWrites=true&w=majority";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0db2mvq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const categoryCollection = client.db('bookishHaven').collection('category')
        const booksCollection = client.db('bookishHaven').collection('books')
        const borrowCollection = client.db('bookishHaven').collection('borrow')


        // auth api ============================
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '110h'
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production" ? true : false,
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                })
                .send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body
            console.log('logOut User', user)
            res.clearCookie('token', {
                maxAge: 0,
                secure: process.env.NODE_ENV === "production" ? true : false,
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
            }).send({ success: true })
        })

        // category api ========================
        app.get('/category', async (req, res) => {
            const result = await categoryCollection.find().toArray()
            res.send(result)
        })


        // Books api ============================
        app.get('/books', async (req, res) => {
            const result = await booksCollection.find().toArray()
            res.send(result)
        })

        app.post('/books', async (req, res) => {
            const book = req.body
            const result = await booksCollection.insertOne(book)
            res.send(result)
        })

        app.put('/books/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedBook = req.body
            const book = {
                $set: {
                    image: updatedBook.image,
                    name: updatedBook.name,
                    quantity: updatedBook.quantity,
                    author: updatedBook.author,
                    category_name: updatedBook.category_name,
                    short_description: updatedBook.short_description,
                    rating: updatedBook.rating,
                    content: updatedBook.content
                }
            }
            const result = await booksCollection.updateOne(query, book, options)
            res.send(result)
        })

        app.patch('/books/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const book = await booksCollection.findOne(query);
            const updatedQuantity = book.quantity - 1;
            const update = {
                $set: {
                    quantity: updatedQuantity
                }
            }
            const result = await booksCollection.updateOne(query, update)
            res.send(result)
        })

        app.get('/books/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await booksCollection.findOne(query)
            res.send(result)
        })

        app.get('/books/category/:category_name', async (req, res) => {
            const category_name = req.params.category_name
            const query = { category_name: category_name }
            const result = await booksCollection.find(query).toArray()
            res.send(result)
        })


        // Borrow Books api ===============================
        app.get('/borrow', verifyToken, async (req, res) => {

            if (req.query.email !== req.user.email) {
                return res.status(401).send({ message: 'not authorized' })
            }

            let query = {}
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await borrowCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/borrow/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await borrowCollection.findOne(query)
            res.send(result)
        })

        app.get('/borrow/:name', async (req, res) => {
            const name = req.params.name

            const existingBorrowRecord = await borrowCollection.findOne({ name: name });
            if (existingBorrowRecord) {
                res.send({ exists: true });
            } else {
                res.json({ exists: false });
            }
        });

        app.post('/borrow', async (req, res) => {
            const borrow = req.body
            const result = await borrowCollection.insertOne(borrow)
            res.send(result)
        })

        app.delete('/borrow/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await borrowCollection.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('the server is running')
})

app.listen(port, (req, res) => {
    console.log('server ok')
})