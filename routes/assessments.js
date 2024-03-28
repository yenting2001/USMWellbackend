const express = require('express')
const {
    getAssessments, 
    getAssessment,
    createAssessment,
    getStudentAssessments
} = require('../controllers/assessmentControllers')

const router = express.Router()

//GET all assessments
router.get('/', getAssessments)

//GET assessments for students
router.get('/student', getStudentAssessments)

//GET a single assessment
router.get('/:id', getAssessment)

//POST a new assessment
router.post('/publish', createAssessment)

module.exports = router