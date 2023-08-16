// adminRoutes.js

const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { isAuthenticated } = require("../utils/authUtils"); 
const PDFDocument = require('pdfkit')

router.get("/dashboard", isAuthenticated, async (req, res) => {
	try {
		// Retrieve all users from the database collections
		const students = await req.app.locals.students.find().toArray();
		const employers = await req.app.locals.employers.find().toArray();
		const admins = await req.app.locals.admins.find().toArray();

		// Render the admin dashboard view with user data
		res.render("./admin/admin-dashboard", { students, employers, admins });
	} catch (error) {
		console.error("Error fetching users:", error);
		res.render("./admin/admin-dashboard", {
			students: [],
			employers: [],
			admins: [],
		});
	}
});

// Route to handle user deletion
router.post("/delete-user", isAuthenticated, async (req, res) => {
	const userId = req.body.userId;

	try {
		// Find the user in both student and employer collections
		const student = await req.app.locals.students.findOne({
			_id: new ObjectId(userId),
		});
		const employer = await req.app.locals.employers.findOne({
			_id: new ObjectId(userId),
		});

		let userCollection;
		let userType;

		if (student) {
			userCollection = req.app.locals.students;
			userType = "student";
		} else if (employer) {
			userCollection = req.app.locals.employers;
			userType = "employer";
		}

		if (userCollection) {
			// If the user is an employer, also delete their job postings
			if (userType === "employer") {
				await req.app.locals.jobPostings.deleteMany({ employerId: userId });
			}

			const result = await userCollection.deleteOne({ _id: new ObjectId(userId) });

			if (result.deletedCount === 1) {
				console.log(`User of type ${userType} deleted successfully`);
			} else {
				console.log(`User of type ${userType} not found or deletion failed`);
			}
		} else {
			console.log("User not found in any collection");
		}

		res.redirect("/admin/dashboard");
	} catch (error) {
		console.error("Error deleting user:", error);
		res.redirect("/admin/dashboard");
	}
});

router.get("/stats", isAuthenticated, async (req, res) => {
	try {
		const studentsCount = await req.app.locals.students.countDocuments();
		const employersCount = await req.app.locals.employers.countDocuments();
		const totalJobPostings = await req.app.locals.jobPostings.countDocuments();

		// Fetch the number of jobs in each industry
		const jobCountsByIndustry = await getJobCountsByIndustry(
			req.app.locals.jobPostings
		);

		// Fetch the number of jobs in each location
		const jobCountsByLocation = await getJobCountsByLocation(
			req.app.locals.jobPostings
		);

		res.render("./admin/admin-stats", {
			studentsCount,
			employersCount,
			totalJobPostings,
			jobCountsByIndustry,
			jobCountsByLocation,
		});
	} catch (error) {
		console.error("Error fetching statistics:", error);
		res.render("./admin/admin-stats", {
			studentsCount: 0,
			employersCount: 0,
			totalJobPostings: 0,
			jobCountsByIndustry: [],
			jobCountsByLocation: [],
		});
	}
});

router.get("/stats-pdf", isAuthenticated, async (req, res) => {
	try {
		const studentsCount = await req.app.locals.students.countDocuments();
		const employersCount = await req.app.locals.employers.countDocuments();
		const totalJobPostings = await req.app.locals.jobPostings.countDocuments();
		const jobCountsByIndustry = await req.app.locals.jobPostings
			.aggregate([{ $group: { _id: "$industry", count: { $sum: 1 } } }])
			.toArray();
		const jobCountsByLocation = await req.app.locals.jobPostings
			.aggregate([{ $group: { _id: "$employerLocation", count: { $sum: 1 } } }])
			.toArray();

		// Create a new PDF document
		const doc = new PDFDocument();
		const filename = "admin-stats.pdf";
		res.setHeader("Content-disposition", "attachment; filename=" + filename);
		res.setHeader("Content-type", "application/pdf");
		doc.pipe(res);

		// Add content to the PDF
		doc.fontSize(16).text("Admin Statistics", { align: "center" });

		doc.fontSize(14).text("Number of Students: " + studentsCount);
		doc.fontSize(14).text("Number of Employers: " + employersCount);
		doc.fontSize(14).text("Total Job Postings: " + totalJobPostings);

		doc.addPage();
		doc.fontSize(16).text("Job Postings by Industry", { align: "center" });
		jobCountsByIndustry.forEach((industry) => {
			doc.fontSize(14).text(`${industry._id}: ${industry.count} jobs`);
		});

		doc.addPage();
		doc.fontSize(16).text("Job Postings by Location", { align: "center" });
		jobCountsByLocation.forEach((location) => {
			doc.fontSize(14).text(`${location._id}: ${location.count} jobs`);
		});

		// Finalize the PDF and send it to the browser
		doc.end();
	} catch (error) {
		console.error("Error generating PDF:", error);
		res.status(500).send("Error generating PDF");
	}
});

// Helper function to fetch job counts by industry
async function getJobCountsByIndustry(jobPostingsCollection) {
	const pipeline = [
		{
			$group: {
				_id: "$industry",
				count: { $sum: 1 },
			},
		},
	];

	const jobCounts = await jobPostingsCollection.aggregate(pipeline).toArray();
	return jobCounts;
}

async function getJobCountsByLocation(jobPostingsCollection) {
	const pipeline = [
		{
			$group: {
				_id: "$employerLocation",
				count: { $sum: 1 },
			},
		},
	];

	const jobCounts = await jobPostingsCollection.aggregate(pipeline).toArray();
	return jobCounts;
}





module.exports = router;
