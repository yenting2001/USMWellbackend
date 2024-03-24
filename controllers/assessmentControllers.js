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

module.exports = {
    getAssessments,
    getAssessment
}
