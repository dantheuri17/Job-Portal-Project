// app.js

const express = require("express");
const { MongoClient } = require("mongodb");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");

const authRouter = require('./routes/authRoutes');
const authUtils = require('./utils/authUtils');
const indexRouter = require('./routes/index');
const studentRoutes = require('./routes/studentRoutes')
const employerRoutes = require('./routes/employerRoutes')

const app = express();
const port = 3000;

app.set("views", "views");
app.set("view engine", "hbs");

app.use(express.urlencoded({ extended: true }));

app.use(
	session({
		secret: "secret-key",
		resave: false,
		saveUninitialized: false,
	})
);

app.use(passport.initialize());
app.use(passport.session());

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
let studentsCollection;
let employersCollection;


client
	.connect()
	.then(() => {
		const loginDb = client.db("loginDb");
		studentsCollection = loginDb.collection("students");
		employersCollection = loginDb.collection("employers");
		
		console.log("Connected to MongoDB");
		app.locals.students = studentsCollection;
		app.locals.employers = employersCollection;
	})
	.catch((error) => {
		console.error("Error connecting to MongoDB: ", error);
	});

passport.use(
	new LocalStrategy(async (username, password, done) => {
		try {
			let user = await studentsCollection.findOne({ username });
			let userType = "student"; // Set default userType to "student"

			if (!user) {
				user = await employersCollection.findOne({ username });
				userType = "employer"; // Set userType to "employer"
			}

			if (!user) {
				console.log("Incorrect username");
				return done(null, false, { message: "Incorrect username" });
			}

			const hashedPassword = authUtils.hashPassword(password);

			console.log("Expected hashed password:", user.password);
			console.log("Actual hashed password:", hashedPassword);

			if (hashedPassword !== user.password) {
				console.log("Incorrect password");
				return done(null, false, { message: "Incorrect password" });
			}

			user.userType = userType; // Add userType property to the user object
			console.log("User authenticated");
			return done(null, user);
		} catch (error) {
			return done(error);
		}
	})
);


passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/student', studentRoutes)
app.use('/employer', employerRoutes)

// Start the server
app.listen(port, () => {
	console.log(`Server started on port ${port}`);
});
