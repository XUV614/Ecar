// server.js

const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
//const { stringify } = require('node-persist');
require('dotenv').config();
const path = require('path')

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// MongoDB connection
mongoose.connect(MONGO_URI
   // useNewUrlParser: true,
   // useUnifiedTopology: true,
).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define the user schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: Number,
        default: 0
    },
    date: {
        type: Date,
        default: Date.now
    },
    address:{
        type:String,
        required:true
    }
});

const User = mongoose.model('User', userSchema);

// product schema and model
const productSchema = new mongoose.Schema({
    url: { type: String },
    name: String,
    category:{
        type:String,
        enum:['car','bike']
    },
    seller: String,
    description:String,
    price: Number,
});

const Product = mongoose.model('Product', productSchema);

// Define the order schema
const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
    },
    name: String,
    address: String,
    contact: String,
    items: [{ productId: String, quantity: Number }],
    grandTotal: Number,
    orderDate: {
        type: Date,
        default: Date.now,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

const Order = mongoose.model('Order', orderSchema);


// Middleware to verify JWT token
const middleware = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// User registration endpoint
app.post('/register', async (req, res) => {
    try {
        const { username, email, password, address } = req.body; 
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword, address }); // Include address in user creation
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});


// User login endpoint
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const payload = {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role // Include user role in the payload
            }
        };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, role: user.role }); // Send the user role in the response
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});


// Assuming you have a middleware to check if the user is logged in and set req.user
app.get('/user/details', middleware, async (req, res) => {
    try {
        // Assuming req.user is populated by the middleware with user's details
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ name: user.username, address: user.address });
    } catch (error) {
        console.error('Fetch user details error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});
// user name address

// Endpoint to add products
app.post('/products', middleware, async (req, res) => {
    try {
        const { url, name, category, seller, price,description } = req.body;
        const newProduct = new Product({ url, name, category, seller, price,description});
        await newProduct.save();
        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error('Add product error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Endpoint to get products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        console.error('Get products error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// server.js
// Add a new endpoint to get a single product by ID
app.get('/products/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Get product by ID error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

app.put('/products/:productId', middleware, async (req, res) => {
    try {
        const productId = req.params.productId;
        const { url, name, category, seller, price, description } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { url, name, category, seller, price, description },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        console.error('Update product error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Endpoint to delete a product by ID
app.delete('/products/:productId', middleware, async (req, res) => {
    try {
        const productId = req.params.productId;

        const deletedProduct = await Product.findByIdAndDelete(productId);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product deleted successfully', product: deletedProduct });
    } catch (error) {
        console.error('Delete product error:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

app.post('/orders', middleware, async (req, res) => {
    try {
        const { orderId, name, address, contact, items, grandTotal } = req.body;
        const userId = req.user.id; // Get user ID from authenticated user

        // Create an array to hold the items for the order
        const orderItems = [];

        // Loop through the items received in the request body
        for (const item of items) {
            const { productId, quantity } = item;

            // Push each item to the orderItems array
            orderItems.push({ productId, quantity });
        }

        // Create a new order instance with the populated items array and userId
        const newOrder = new Order({
            orderId,
            name,
            address,
            contact,
            items: orderItems,
            grandTotal,
            userId, // Include userId in the order
        });

        // Save the order to the database
        await newOrder.save();

        res.status(201).json({ message: 'Order placed successfully', order: newOrder });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Endpoint to cancel an order by orderId
app.delete('/orders/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const deletedOrder = await Order.findOneAndDelete({ orderId });
      if (!deletedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      res.status(200).json({ message: 'Order canceled successfully', order: deletedOrder });
    } catch (error) {
      console.error('Delete order error:', error.message);
      res.status(500).json({ message: 'Server Error' });
    }
  });
  


  // Endpoint to get all orders
app.get('/orders', async (req, res) => {
    try {
      const orders = await Order.find();
      res.status(200).json(orders);
    } catch (error) {
      console.error('Get orders error:', error.message);
      res.status(500).json({ message: 'Server Error' });
    }
  });



app.get('/orders/user', middleware, async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from authenticated user
        const userOrders = await Order.find({ userId });

        res.status(200).json(userOrders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

  
app.use(express.static(path.join(__dirname,'./build')))
app.use('*',function(req,res){res.sendFile(path.join(__dirname,'./build/index.html'))})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
