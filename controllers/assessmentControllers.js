const supabase = require('../config/supabaseClient')

//get all assessments
const getAssessments = async (req, res) => {
    try {
        // Fetch scales data
        const { data: scalesData, error: scalesError } = await supabase
            .from('scale')
            .select('*');

        if (scalesError) {
            throw scalesError;
        }

        const { data: tools, error: toolError } = await supabase
            .from('tool')
            .select('*')
            .order('tool_id', {ascending: true});

        if (toolError) {
            throw toolError;
        }

        const toolsWithQuestions = await Promise.all(tools.map(async (tool) => {
            const { data: questions, error: questionError } = await supabase
                .from('question')
                .select('*')
                .eq('tool_id', tool.tool_id);

            if (questionError) {
                throw questionError;
            }

            const questionsWithScales = await Promise.all(questions.map(async (question) => {
                const { data: questionScales, error: scaleError } = await supabase
                    .from('question_scale')
                    .select('scale_id')
                    .eq('question_id', question.question_id);

                if (scaleError) {
                    throw scaleError;
                }

                const scales = questionScales.map(({ scale_id }) => {
                    return scalesData.find(scale => scale.scale_id === scale_id);
                });

                return { ...question, scales };
            }));

            return { ...tool, questions: questionsWithScales };
        }));

        res.status(200).json(toolsWithQuestions);
    } catch (error) {
        console.error('Error fetching assessments:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getStudentAssessments = async (req, res) => {
    try {
        // Assuming you have the current user's ID available in req.user.id
        const studentId = req.header('student-id');

        // Fetch student assessments from the database
        const { data: assessments, error } = await supabase
            .from('student_assessment')
            .select('tool_id, assessment_start_date, assessment_end_date')
            .eq('student_id', studentId)
            .order('assessment_start_date');

        if (error) {
            throw error;
        }

        // Preprocess assessments
        const preprocessedAssessments = preprocessAssessments(assessments);

        res.status(200).json(preprocessedAssessments);
    } catch (error) {
        console.error('Error fetching and preprocessing student assessments:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Function to preprocess assessments by combining those with the same start and end dates
const preprocessAssessments = (assessments) => {
    const combinedAssessments = [];

    assessments.forEach((assessment) => {
        // Check if there is already a combined assessment with the same title
        const existingCombinedAssessment = combinedAssessments.find(
            (item) => item.title === `${assessment.assessment_start_date} to ${assessment.assessment_end_date}`
        );

        if (existingCombinedAssessment) {
            // Add tool to the existing combined assessment
            existingCombinedAssessment.tools.push(assessment.tool_id);
        } else {
            // Create a new combined assessment
            combinedAssessments.push({
                title: `${assessment.assessment_start_date} to ${assessment.assessment_end_date}`,
                startDate: assessment.assessment_start_date,
                endDate: assessment.assessment_end_date,
                tools: [assessment.tool_id],
            });
        }
    });

    return combinedAssessments;
};

const getAssessment = async (req, res) => {
    const {id:assessmentId} = req.params

    try {
        // Fetch the assessment tool
        const { data: tool, error: toolError } = await supabase
            .from('tool')
            .select('*')
            .eq('tool_id', assessmentId)
            .single();

        if (toolError) {
            throw toolError;
        }

        if (!tool) {
            return res.status(404).json({ error: 'Assessment tool not found' });
        }

        // Fetch the questions for the assessment tool
        const { data: questions, error: questionsError } = await supabase
            .from('question')
            .select('*')
            .eq('tool_id', assessmentId);

        if (questionsError) {
            throw questionsError;
        }

        // Fetch the scales for each question
        for (let i = 0; i < questions.length; i++) {
            const questionId = questions[i].question_id;
            const { data: questionScales, error: scalesError } = await supabase
                .from('question_scale')
                .select('scale_id')
                .eq('question_id', questionId);

            if (scalesError) {
                throw scalesError;
            }

            // Extract the scale IDs for the question
            const scaleIds = questionScales.map(qs => qs.scale_id);

            // Fetch the scales using the extracted scale IDs
            const { data: scales, error: scalesFetchError } = await supabase
                .from('scale')
                .select('*')
                .in('scale_id', scaleIds);

            if (scalesFetchError) {
                throw scalesFetchError;
            }

            questions[i].scales = scales;
        }

        // Combine tool and questions into a single object
        const assessment = {
            tool: tool,
            questions: questions
        };

        res.status(200).json(assessment);
    } catch (error) {
        console.error('Error fetching assessment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const createAssessment = async (req, res) => {

    try {
        const { studentGroups, selectedSchools, tools, adminId, startDate, endDate } = req.body;

        const studentIds = await getStudentIds(studentGroups, selectedSchools);

        // Prepare data for insertion
        const assessmentsData = [];

        for (const toolId in tools) {
            if (tools.hasOwnProperty(toolId) && tools[toolId] === true) {
                // Iterate over studentIds
                for (const studentId of studentIds) {
                    assessmentsData.push({
                        student_id: studentId,
                        tool_id: toolId,
                        admin_id: adminId,
                        assessment_start_date: startDate,
                        assessment_end_date: endDate
                    });
                }
            }
        }

        // Example: Insert data into a Supabase table named 'published_assessments'
        const { data, error } = await supabase.from('student_assessment').insert(assessmentsData);

        if (error) {
            throw error;
        }

        res.status(200).json({ success: true, message: 'Assessment published successfully!' });
    }catch(error) {
        console.error('Error publishing assessment:', error.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }

}
const getStudentIds = async (studentGroups, selectedSchools) => {
    const studentIds = [];

    for (const group of studentGroups) {
        const { value: enrollmentYear } = group; // Assuming enrollmentYear is stored in the 'value' property

        for (const school of selectedSchools) {
            const { value: schoolName } = school;

            // Fetch student IDs from database based on enrollmentYear and schoolYear
            const { data, error } = await supabase
                .from('student')
                .select('id')
                .eq('stud_enrollment_year', enrollmentYear)
                .eq('stud_school', schoolName);

            if (error) {
                throw error;
            }

            // Extract student IDs from the data and push into the studentIds array
            data.forEach(student => {
                studentIds.push(student.id);
            });
        }
    }

    return studentIds;
};

module.exports = {
    getAssessments,
    getAssessment,
    createAssessment,
    getStudentAssessments
}
