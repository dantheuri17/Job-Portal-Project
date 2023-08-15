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
				const studentIndustryJobs = await getJobsFromStudentIndustry(
					jobPostingsCollection,
					student.industry
				);

				const jobListingsWithSavedFlag = studentIndustryJobs.map((job) => {
					let isSaved = false;
					if (student.savedPosts && Array.isArray(student.savedPosts)) {
						isSaved = student.savedPosts.includes(job._id.toString());
					}

					return {
						...job,
						isSaved: isSaved,
					};
				});

				const jobListings = {
					studentIndustryJobs: jobListingsWithSavedFlag,
				};

				res.render("./students/student-dashboard", { jobListings });
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
				// Check if profile picture data exists before accessing it
				const profilePictureData =
					student.profilePicture &&
					student.profilePicture.binaryProfilePictureData
						? student.profilePicture.binaryProfilePictureData
						: null;

				// Set the profile picture as a data URL if data is available
				if (profilePictureData) {
					student.profilePicture = `data:image/jpeg;base64,${profilePictureData.toString(
						"base64"
					)}`;
				}

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


router.get("/resume", async (req, res) => {
	const students = req.app.locals.students;

	try {
		const user = req.user;
		if (user) {
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
			studentEmail,
			studentAcademicSchool,
			studentMajor,
			studentIndustry,
			studentLocation,
			studentAddress,
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
				if (studentEmail) {
					Object.assign(updateObject.$set, { email: studentEmail });
				}
				if (studentAcademicSchool) {
					Object.assign(updateObject.$set, {
						studentAcademicSchool: studentAcademicSchool,
					});
				}
				if (studentMajor) {
					Object.assign(updateObject.$set, { major: studentMajor });
				}
				if (studentIndustry) {
					Object.assign(updateObject.$set, { industry: studentIndustry });
				}
				if (studentLocation) {
					Object.assign(updateObject.$set, { location: studentLocation });
				}
				if (studentAddress) {
					Object.assign(updateObject.$set, { studentAddress, studentAddress });
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
	const studentsCollection = req.app.locals.students;
	const jobPostingsCollection = req.app.locals.jobPostings;
	const user = req.user;

	try {
		if (user && user.userType === "student") {
			const student = await studentsCollection.findOne({
				_id: new ObjectId(user._id),
			});

			if (student) {
				const { jobTitle, location, industry, jobType, jobLevel } = req.body;

				// Initialize student.savedPosts if it's not defined
				if (!student.savedPosts) {
					student.savedPosts = [];
				}

				// Prepare filter options
				const filters = {};
				if (jobTitle) filters.jobTitle = new RegExp(jobTitle, "i");
				if (location) filters.employerLocation = new RegExp(location, "i");
				if (industry) filters.industry = industry;
				if (jobType) filters.jobType = jobType;
				if (jobLevel) filters.jobLevel = jobLevel;

				// Fetch and filter job listings from the database
				const filteredJobs = await jobPostingsCollection
					.find(filters)
					.toArray();

				const jobListingsWithSavedFlag = filteredJobs.map((job) => {
					return {
						_id: job._id,
						jobTitle: job.jobTitle,
						company: job.company,
						employerLocation: job.employerLocation,
						jobType: job.jobType,
						isSaved: student.savedPosts.includes(job._id.toString()),
					};
				});

				const jobListings = {
					studentIndustryJobs: jobListingsWithSavedFlag,
				};

				console.log("Filtered Job Listings", jobListings);
				res.render("./students/student-dashboard", {
					jobListings,
					query: { jobTitle, location, industry, jobType, jobLevel },
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




router.get("/job-post", async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const jobId = req.query.id;
	try {
		const jobPost = await jobPostingsCollection.findOne({
			_id: new ObjectId(jobId),
		});

		if (jobPost) {
			res.render("./jobs/student-job-post", { jobPost });
		} else {
			res.status(404).send("Job not found");
		}
	} catch (error) {
		console.error("Error retrieving job details:", error);
		res.status(500).send("An error occurred while fetching job details");
	}
});

router.get("/applied-jobs", isAuthenticated, async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const studentsCollection = req.app.locals.students;
	const user = req.user;

	try {
		const student = await studentsCollection.findOne({
			_id: new ObjectId(user._id),
		});

		if (student) {
			const appliedJobs = student.appliedJobs || []; // Initialize as empty array if undefined

			const appliedJobIds = appliedJobs.map((job) => job.jobId); // Extract job IDs from objects

			// Convert extracted IDs to ObjectId format
			const appliedJobObjectIds = appliedJobIds.map((id) => new ObjectId(id));

			allAppliedJobs = await jobPostingsCollection
				.find({
					_id: { $in: appliedJobObjectIds },
				})
				.toArray();

			// Combine allAppliedJobs with status of applications
			const allAppliedJobsWithStatus = allAppliedJobs.map((job) => {
				const appliedJob = appliedJobs.find(
					(appliedJob) => appliedJob.jobId === job._id.toString()
				);
				if (appliedJob) {
					return { ...job, status: appliedJob.status };
				} else {
					return job;
				}
			});

			res.render("./students/student-applied-jobs", {
				allAppliedJobs: allAppliedJobsWithStatus,
			});
		} else {
			res.render("./students/student-applied-jobs", { allAppliedJobs: [] });
		}
	} catch (error) {
		console.error("Error retrieving applied job details", error);
		res.status(500).send("Error occurred while fetching applied job details");
	}
});


router.post("/apply-job", isAuthenticated, async (req, res) => {
	const studentsCollection = req.app.locals.students;
	const user = req.user;
	const jobId = req.body.jobId;

	try {
		if (user && user.userType === "student") {
			const studentId = user._id;

			const student = await studentsCollection.findOne({
				_id: new ObjectId(studentId),
			});

			if (!student) {
				return res.sendStatus(401); // Unauthorized
			}

			// Check if the required fields are filled
			if (
				!student.username ||
				!student.password ||
				!student.accountType ||
				!student.email ||
				!student.firstName ||
				!student.lastName ||
				!student.location ||
				!student.major ||
				!student.profilePicture ||
				!student.resume ||
				!student.industry
			) {
				req.flash("error", "Please fill out all the required details.");
				return res.redirect("/student/dashboard"); // Redirect back to the application page
			}

			// If all required fields are filled, proceed with the application
			const status = "Pending";

			await studentsCollection.updateOne(
				{ _id: new ObjectId(studentId) },
				{ $push: { appliedJobs: { jobId: jobId, status: status } } }
			);

			console.log("Job application submitted successfully");
			req.flash("success", "Job application submitted successfully.");
			res.redirect("/student/dashboard"); // Redirect with success flash message
		} else {
			console.log("Invalid user or user type");
			res.sendStatus(401);
		}
	} catch (error) {
		console.error("Error submitting job application:", error);
		res.sendStatus(500);
	}
});


router.get("/saved-posts", isAuthenticated, async (req, res) => {
	const user = req.user;
	const studentsCollection = req.app.locals.students;
	const jobsCollection = req.app.locals.jobPostings;
	let allSavedPosts = [];

	try {
		const student = await studentsCollection.findOne({
			_id: new ObjectId(user._id),
		});

		if (student) {
			const savedPostsId = student.savedPosts;

			allSavedPosts = await jobsCollection
				.find({
					_id: { $in: savedPostsId.map((id) => new ObjectId(id)) },
				})
				.toArray();

			// Check and mark saved status for each job
			const jobListingsWithSavedFlag = allSavedPosts.map((job) => {
				return {
					...job,
					isSaved: true,
				};
			});

			res.render("./students/saved-posts", {
				allSavedPosts: jobListingsWithSavedFlag,
			});
		}
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
		const postId = req.body.postId;
		const studentId = user._id;

		if (!postId) {
			return res.sendStatus(400);
		}

		const student = await studentsCollection.findOne({
			_id: new ObjectId(studentId),
		});

		if (!student) {
			return res.sendStatus(404);
		}

		const savedPosts = student.savedPosts || []; // Initialize if undefined

		if (savedPosts.includes(postId)) {
			// Remove the postId from savedPosts
			await studentsCollection.updateOne(
				{ _id: new ObjectId(studentId) },
				{ $pull: { savedPosts: postId } }
			);
			console.log("Post removed from saved posts");
			res.sendStatus(204);
		} else {
			// Add the postId to savedPosts
			await studentsCollection.updateOne(
				{ _id: new ObjectId(studentId) },
				{ $addToSet: { savedPosts: postId } }
			);
			console.log("Post saved successfully");
			res.sendStatus(204);
		}
	} catch (error) {
		console.error("Error saving/removing post:", error);
		res.sendStatus(500);
	}
});



module.exports = router;
