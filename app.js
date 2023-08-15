// app.js

const express = require("express");
const { MongoClient } = require("mongodb");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const hbs = require("hbs");
const authRouter = require("./routes/authRoutes");
const authUtils = require("./utils/authUtils");
const indexRouter = require("./routes/index");
const studentRoutes = require("./routes/studentRoutes");
const employerRoutes = require("./routes/employerRoutes");
const adminRoutes = require('./routes/adminRoutes')
const flash = require("express-flash");
const methodOverride = require("method-override");

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
app.use(express.json());
app.use(methodOverride("_method"));

app.use(
	session({
		secret: "secret-key",
		resave: false,
		saveUninitialized: false,
	})
);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.get("/", (req, res) => {
	res.render("home");
});

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
let studentsCollection;
let employersCollection;
let jobPostingsCollection;
let adminsCollection;

client
	.connect()
	.then(() => {
		const loginDb = client.db("loginDb");
		studentsCollection = loginDb.collection("students");
		employersCollection = loginDb.collection("employers");
		jobPostingsCollection = loginDb.collection("jobPostings");
		adminsCollection = loginDb.collection("admins"); // Initialize adminsCollection here

		console.log("Connected to MongoDB");
		app.locals.students = studentsCollection;
		app.locals.employers = employersCollection;
		app.locals.jobPostings = jobPostingsCollection;
		app.locals.admins = adminsCollection; // Add this line
	})
	.catch((error) => {
		console.error("Error connecting to MongoDB: ", error);
	});

// Inside the database connection setup
const adminUser = {
	username: "admin",
	password: authUtils.hashPassword("admin"), // Hash the password
};

passport.use(
	new LocalStrategy(async (username, password, done) => {
		try {
			username = username.trim();

			// Check if the user is an admin
			const admin = await adminsCollection.findOne({ username });
			if (admin && admin.password === password) {
				console.log("Admin authenticated");
				return done(null, admin);
			}

			// Check if the user is a student
			let user = await studentsCollection.findOne({ username });
			if (user) {
				const hashedPassword = authUtils.hashPassword(password);
				if (hashedPassword === user.password) {
					user.userType = "student";
					console.log("Student authenticated");
					return done(null, user);
				}
			}

			// Check if the user is an employer
			user = await employersCollection.findOne({ username });
			if (user) {
				const hashedPassword = authUtils.hashPassword(password);
				if (hashedPassword === user.password) {
					user.userType = "employer";
					console.log("Employer authenticated");
					return done(null, user);
				}
			}

			console.log("Incorrect credentials");
			return done(null, false, { message: "Incorrect credentials" });
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

app.use("/", authRouter);
app.use("/", indexRouter);
app.use('/admin', adminRoutes)
app.use("/student", studentRoutes);
app.use("/employer", employerRoutes);

app.listen(port, () => {
	console.log(`Server started on port ${port}`);
});
