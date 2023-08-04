// app.js

const express = require("express");
const { MongoClient } = require("mongodb");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const hbs = require('hbs')
const authRouter = require('./routes/authRoutes');
const authUtils = require('./utils/authUtils');
const indexRouter = require('./routes/index');
const studentRoutes = require('./routes/studentRoutes')
const employerRoutes = require('./routes/employerRoutes')

const app = express();
const port = 3000;

app.set("views", "views");
hbs.registerHelper("stripTags", function (value) {
	const regex = /(<([^>]+)>)/gi;
	return value.replace(regex, "");
});

hbs.registerHelper("eq", function (a, b) {
	return a === b;
});

app.set("view engine", "hbs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json())

app.use(
	session({
		secret: "secret-key",
		resave: false,
		saveUninitialized: false,
	})
);

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
	res.render('home')
})

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
let studentsCollection;
let employersCollection;
let jobPostingsCollection; 


client
	.connect()
	.then(() => {
		const loginDb = client.db("loginDb");
		studentsCollection = loginDb.collection("students");
		employersCollection = loginDb.collection("employers");
		jobPostingsCollection = loginDb.collection("jobPostings");
		
		console.log("Connected to MongoDB");
		app.locals.students = studentsCollection;
		app.locals.employers = employersCollection;
		app.locals.jobPostings = jobPostingsCollection;
	})
	.catch((error) => {
		console.error("Error connecting to MongoDB: ", error);
	});

passport.use(
	new LocalStrategy(async (username, password, done) => {
		try {
			let user = await studentsCollection.findOne({ username });
			let userType = "student"; 

			if (!user) {
				user = await employersCollection.findOne({ username });
				userType = "employer"; 
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

			user.userType = userType; 
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


app.listen(port, () => {
	console.log(`Server started on port ${port}`);
});
