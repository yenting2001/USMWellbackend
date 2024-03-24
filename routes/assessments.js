const express = require('express')
const {
    getAssessments, 
    getAssessment,
} = require('../controllers/assessmentControllers')

const router = express.Router()

//GET all assessments
router.get('/', getAssessments)

//GET a single assessment
router.get('/:id', getAssessment)

module.exports = router