const express = require("express");
const router = express.Router();
const { ObjectId, Binary } = require("mongodb");
const multer = require("multer");
const {isAuthenticated} = require('../utils/authUtils')



// Multer storage configuration for profile picture upload
const storage = multer.memoryStorage();
const upload = multer({ storage });


router.get("/profile", isAuthenticated, async (req, res) => {
	const students = req.app.locals.students;

	try {
		// Retrieve the currently logged-in user from the session
		const user = req.user;
		if (user && user.userType === "student") {
			// Find the student document by ID in the database
			const student = await students.findOne({ _id: new ObjectId(user._id) });

			if (student) {
				// Decode the profile picture data from base64 to binary
				const profilePictureData = student.profilePicture.binaryProfilePictureData;

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
		// Retrieve the currently logged-in user from the session
		const user = req.user;
		if (user && user.userType === "student") {
			// Find the student document by ID in the database
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
			studentLocation,
		} = req.body;

		// Retrieve the currently logged-in user from the session
		const user = req.user;
		if (user && user.userType === "student") {
			try {
				// Construct the update object based on the provided fields
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

				// Update the student's information in the database
				await students.updateOne({ _id: new ObjectId(user._id) }, updateObject);
				console.log("update object", updateObject);

				console.log("Student information updated successfully");
				res.redirect("/student/settings");
			} catch (error) {
				console.error("Error updating student information:", error);
				res.redirect("/student/settings");
			}
		} else {
			res.redirect("/login");
		}
	}
);

module.exports = router;
