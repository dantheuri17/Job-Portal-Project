const express = require("express");
const router = express.Router();
const { ObjectId, Binary } = require("mongodb");
const multer = require("multer");
const {
	isAuthenticated,
	hashPassword,
	comparePasswords,
} = require("../utils/authUtils");

// const {getJobsFromDatabase} = require("../utils/jobUtils");

// Multer storage configuration for profile picture upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Function to get 6 jobs from the student's industry

const getJobsFromStudentIndustry = async (jobPostingsCollection, industry) => {
	try {
		const jobs = await jobPostingsCollection
			.find({ industry: industry })
			.limit(6)
			.toArray();
		return jobs;
	} catch (error) {
		console.error("Error fetching jobs from the database:", error);
		return [];
	}
};

router.get("/dashboard", isAuthenticated, async (req, res) => {
	const studentsCollection = req.app.locals.students;
	const jobPostingsCollection = req.app.locals.jobPostings;
	const user = req.user;

	try {
		if (user && user.userType === "student") {
			const student = await studentsCollection.findOne({
				_id: new ObjectId(user._id),
			});

			if (student) {
				// Fetch job listings based on the student's industry preference (6 jobs in this example)
				const industryJobs = await getJobsFromStudentIndustry(
					jobPostingsCollection,
					student.industry
				);
				res.render("./students/student-dashboard", {
					student,
					industryJobs, // Pass the industry-specific job listings to the view
				});
			} else {
				console.log("Student not found");
				res.redirect("/login");
			}
		} else {
			console.log("Invalid user or user type");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error retrieving student dashboard:", error);
		res.redirect("/login");
	}
});

router.get("/profile", isAuthenticated, async (req, res) => {
	const students = req.app.locals.students;

	try {
		const user = req.user;
		if (user && user.userType === "student") {
			// Find the student document by ID in the database
			const student = await students.findOne({ _id: new ObjectId(user._id) });

			if (student) {
				// Decode the profile picture data from base64 to binary
				const profilePictureData =
					student.profilePicture.binaryProfilePictureData;

				// Set the profile picture as a data URL
				student.profilePicture = `data:image/jpeg;base64,${profilePictureData.toString(
					"base64"
				)}`;

				res.render("./students/student-profile", { student });
			} else {
				console.log("Student not found");
				res.redirect("/login");
			}
		} else {
			console.log("Invalid user or user type");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error retrieving student profile:", error);
		res.redirect("/login");
	}
});

router.get("/resume", isAuthenticated, async (req, res) => {
	const students = req.app.locals.students;

	try {
		const user = req.user;
		if (user && user.userType === "student") {
			const student = await students.findOne({ _id: new ObjectId(user._id) });

			if (student && student.resume && student.resume.binaryResumeData) {
				const resumeData = student.resume.binaryResumeData.buffer;
				res.setHeader("Content-Type", "application/pdf");
				res.setHeader("Content-Disposition", "attachment; filename=resume.pdf");
				res.send(resumeData);
			} else {
				console.log("Student resume not found");
				res.redirect("/login");
			}
		} else {
			console.log("Invalid user or user type");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error retrieving student resume:", error);
		res.redirect("/login");
	}
});

router.get("/settings", isAuthenticated, (req, res) => {
	res.render("./students/student-settings");
});

router.post(
	"/settings",
	isAuthenticated,
	upload.fields([
		{ name: "profilePicture", maxCount: 1 },
		{ name: "resume", maxCount: 1 },
	]),
	async (req, res) => {
		const students = req.app.locals.students;
		const {
			studentFirstName,
			studentLastName,
			studentMajor,
			studentEmail,
			studentIndustry,
			studentLocation,
			oldPassword,
			newPassword,
			confirmPassword,
		} = req.body;

		const user = req.user;
		if (user && user.userType === "student") {
			try {
				const updateObject = {
					$set: {},
				};

				if (studentFirstName) {
					Object.assign(updateObject.$set, { firstName: studentFirstName });
				}
				if (studentLastName) {
					Object.assign(updateObject.$set, { lastName: studentLastName });
				}
				if (studentMajor) {
					Object.assign(updateObject.$set, { major: studentMajor });
				}
				if (studentEmail) {
					Object.assign(updateObject.$set, { email: studentEmail });
				}
				if (studentIndustry) {
					Object.assign(updateObject.$set, { industry: studentIndustry });
				}
				if (studentLocation) {
					Object.assign(updateObject.$set, { location: studentLocation });
				}

				// If a profile picture is uploaded, add it to the update object
				if (req.files && req.files.profilePicture) {
					const profilePictureData = req.files.profilePicture[0].buffer;
					const binaryProfilePictureData = new Binary(profilePictureData);
					if (!updateObject["$set"]) {
						updateObject["$set"] = {};
					}
					updateObject["$set"].profilePicture = {
						binaryProfilePictureData,
					};
				}

				// If a resume is uploaded, add it to the update object
				if (req.files && req.files.resume) {
					const resumeData = req.files.resume[0].buffer;
					const binaryResumeData = new Binary(resumeData);
					if (!updateObject["$set"]) {
						updateObject["$set"] = {};
					}
					updateObject["$set"].resume = {
						binaryResumeData,
					};
				}

				await students.updateOne({ _id: new ObjectId(user._id) }, updateObject);

				// Change password if old password, new password, and confirm password are provided
				if (oldPassword && newPassword && confirmPassword) {
					const student = await students.findOne({
						_id: new ObjectId(user._id),
					});

					// Verify the old password
					const isPasswordCorrect = comparePasswords(
						oldPassword,
						student.password
					);
					if (!isPasswordCorrect) {
						console.log("Old password is incorrect");
						// You can handle the error and show an appropriate message to the user
						return res.redirect("/student/settings");
					}

					// Check if the new password and confirm password match
					if (newPassword !== confirmPassword) {
						console.log("New password and confirm password do not match");
						// You can handle the error and show an appropriate message to the user
						return res.redirect("/student/settings");
					}

					const hashedPassword = hashPassword(newPassword);

					await students.updateOne(
						{ _id: new ObjectId(user._id) },
						{ $set: { password: hashedPassword } }
					);

					console.log("Password changed successfully");
				}

				console.log("Student information updated successfully");
				res.redirect("/student/profile");
			} catch (error) {
				console.error("Error updating student information:", error);
				res.redirect("/student/settings");
			}
		} else {
			res.redirect("/login");
		}
	}
);

router.post("/search", isAuthenticated, async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const user = req.user;

	try {
		if (user && user.userType === "student") {
			const { jobTitle, location } = req.body;

			// Fetch all jobs from the database
			const allJobs = await jobPostingsCollection.find().toArray();

			const filteredJobs = allJobs.filter((job) => {
				let titleMatch = false;
				let locationMatch = false;

				if (jobTitle) {
					titleMatch = job.jobTitle
						.toLowerCase()
						.includes(jobTitle.toLowerCase());
				}

				if (location && job.employerLocation) {
					locationMatch = job.employerLocation
						.toLowerCase()
						.includes(location.toLowerCase());
				}
				return titleMatch || locationMatch;
			});

			res.render("./students/student-dashboard", {
				student: user,
				jobListings: filteredJobs,
			});
		} else {
			console.log("Invalid user or user type");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error retrieving student dashboard:", error);
		res.redirect("/login");
	}
});


router.get("/job-post", async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const jobId = req.query.id; 
	try {

		const jobPost = await jobPostingsCollection.findOne({
			_id: new ObjectId(jobId),
		});

		if (jobPost) {
			
			res.render("./jobs/job-post", { jobPost });
		} else {
			
			res.status(404).send("Job not found");
		}
	} catch (error) {
		
		console.error("Error retrieving job details:", error);
		res.status(500).send("An error occurred while fetching job details");
	}
});

router.get("/saved-posts", isAuthenticated, async (req, res) => {
	const user = req.user;
	const studentsCollection = req.app.locals.students;
	const jobsCollection = req.app.locals.jobPostings;
	let allSavedPosts = []; // Change from const to let


	try {
		const student = await studentsCollection.findOne({
			_id: new ObjectId(user._id), // Use ObjectId to convert the user ID to ObjectId
		});

		if (student) {
			const savedPostsId = student.savedPosts;
			
			allSavedPosts = await jobsCollection
				.find({
					_id: { $in: savedPostsId.map((id) => new ObjectId(id)) }, // Convert the saved post IDs to ObjectId
				})
				.toArray();
		}
		res.render("./students/saved-posts", { allSavedPosts });
	} catch (error) {
		console.log("error retrieving saved post:", error);
		res
			.status(500)
			.json({ error: "An error occurred while retrieving saved Job Posts" });
	}
});

router.post("/save-post", isAuthenticated, async (req, res) => {
	const studentsCollection = req.app.locals.students;
	const user = req.user;

	try {
		const postId = req.body.postId; // Assuming the post ID is sent in the request body
		const studentId = user._id;

		// Update the student document and add the post ID to the savedPosts array if it's not already saved
		    await studentsCollection.updateOne(
					{ _id: new ObjectId(studentId) },
					{ $addToSet: { savedPosts: postId } }
				);
				
		console.log("Post saved successfully"); 
		res.sendStatus(200); // Send a response status 200 (OK) indicating the post was saved successfully
	} catch (error) {
		console.error("Error saving post:", error);
		res.sendStatus(500); // Send a response status 500 (Internal Server Error) if there was an error
	}
});


module.exports = router;
