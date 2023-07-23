const { ObjectId } = require("mongodb");

// Pass the jobPostingsCollection as an argument to the function
const getJobsFromDatabase = async ( jobPostingsCollection,{ industry, limit }) => {
	try {
		const jobs = await jobPostingsCollection
			.find({ jobType: industry })
			.limit(limit)
			.toArray();

		return jobs;
	} catch (error) {
		console.error("Error fetching jobs from the database:", error);
		return [];
	}
};

module.exports = { getJobsFromDatabase };
