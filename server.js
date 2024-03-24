require('dotenv').config()

const express = require('express')
const supabase = require('./config/supabaseClient')
const assessmentRoutes = require('./routes/assessments')

//express app
const app = express()

//middleware


//routes
app.use('/api/assessment', assessmentRoutes)
app.get('/', (req, res) => {
    res.json({mssg: 'welcome'})
})

//connect to database
supabase
    .auth.signUp({email: '', password: ''})
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log('listening on port', process.env.PORT)
        })
    })
    .catch((error) => {
        console.log(error)
    })
