const pug = require('pug');
const express = require('express')
const mysql = require('mysql');
const session = require('express-session');
const bodyParser = require('body-parser');
const flash = require('connect-flash');

const DateDiff = require('date-diff');

const connection = mysql.createConnection({
    host     : '45.55.136.114',
    user     : 'dreamersF2022',
    password : 'w8keupnow!',
    database : 'dreamersF2022'
});

const app = express();
app.use(session({
    secret: 'secret',
    resave: true,
    cookie: { maxAge: 86060*1000 },  // 8 hours
    saveUninitialized: true
}));
app.use(flash());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }))
app.use(bodyParser.json())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('views', 'views');
app.set('view engine', 'pug');
app.get("/home",(req,res)=>{
    let data = {loginError: req.flash('loginError')};
    console.log(data.loginError)
    res.render('Home', data)
});

app.post('/login', function(request, response) {
    // Capture the input fields
    let username = request.body.username;
    let password = request.body.password;
    // Ensure the input fields exists and are not empty
    if (username && password) {
        // Execute SQL query that'll select the account from the database based on the specified username and password
        connection.query('SELECT * FROM Login WHERE UID = ? AND Password = ?', [username, password], function(error, results, fields) {
            // If there is an issue with the query, output the error
            if (error) throw error;
            // If the account exists
            if (results.length > 0) {
                // Authenticate the user
                request.session.loggedin = true;
                request.session.username = username;
                // Redirect to home page
                connection.query('SELECT Role FROM employees WHERE EmployeeID = ? ', [request.session.username], function(error, results, fields) {
                    // If there is an issue with the query, output the error
                    if (error) throw error;
                    // If the account exists
                    request.session.role = results[0].Role;
                    //console.log(results[0].Role)
                    if(request.session.role === "Employee")
                    {
                        response.redirect('/schedule');
                    }
                    else if(request.session.role === "Manager")
                    {
                        response.redirect('/manSchedule');
                    }
                })
            } else {
                let data = {message: 'ID and/or password is incorrect'};
                request.flash('loginError', 'ID and/or password is incorrect');
                response.redirect('/Home');
                //response.status(409).json({error: 'ID and/or password is incorrect'});
            }
        })
    } else {

        request.flash('error', 'ID and/or password is incorrect');
        response.redirect('/Home');
    }
});
app.get("/schedule",(req,res)=>{
    let username = req.session.username;
    connection.query('SELECT * FROM requests WHERE employeeId = ? ORDER BY DateSubmitted', [username], function(error, results, fields) {

        if (error) throw error;

        let string=JSON.stringify(results);
        let json =  JSON.parse(string);
        for(let index in json) {
            var obj = json[index];
            for(objectIndex in obj) {
                if(objectIndex != "PROJ_ALLOC_NO") {
                    // if (objectIndex === "StartDate")
                    // {
                    //     obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0,10).slice(5, 10);
                    // }
                    // if (objectIndex === "EndDate")
                    // {
                    //     obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0,10).slice(5, 10);
                    // }
                    if (objectIndex === "DateSubmitted")
                    {
                        obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0,10).slice(5, 10);
                    }
                }
            }
        }
        //console.log(json)
        res.render('Schedule', {
            data: json
        })

    });

});
app.get("/request",(request,res)=>{
    //Get currently authed user's ID
    let currentUserID = request.session.username;
    //console.log(currentUserID);

    //Query the employee information of currently logged-in user as well as currently set max PTO days
    connection.query('SELECT e.FirstName, e.LastName, e.role, e.PtoBalanceVacation, e.PtoBalancePersonal, e.PtoBalanceSick, pto.MaxVacation, pto.MaxPersonal, pto.MaxSick FROM employees e, PTO pto WHERE e.EmployeeId = ? AND e.Role = pto.Role AND pto.NumberOfYears = 0',
        [currentUserID], function(error, results, fields) {
            if(error){
                console.log(error);
            }
            if( results.length === 0 ) {
                console.log('This user ID does not exist!');
            }
            else {
                res.render('Request', results[0])
            }
        });

});
app.post('/postreq', function(req, res) {
    // Capture the input fields
    res.render('Schedule')
    let currentUserID = req.session.username;
    console.log(req.body)

    connection.query('SELECT COUNT(*) AS Count FROM requests UNION SELECT LeaderId FROM employees where EmployeeId = ?',
        [currentUserID], function(error, results, fields) {
            if(error){
                console.log(error);
            }
            if( results.length === 0 ) {
                console.log('This user ID does not exist!');
            }
            else {
                let requestId = parseInt(results[0].Count) + 1;
                let leaderId = results[1].Count;   
                let reqStatus = "Pending";
                //console.log(req.body.daterange);
                let reqType = req.body.inputType;
                let startDate = req.body.startDate;
                let endDate = req.body.endDate;
                //let startDate = dates[0].replace("/", "-").replace("/", "-");
                //let endDate = dates[1].replace(/\s/g, '').replace("/", "-").replace("/", "-");
                let comments = req.body.inputComments;
                let dateTimeUTC = new Date().toJSON().slice(0,19).replace('T',' ');

                console.log(startDate + endDate)

                let sql = `INSERT INTO requests (RequestId, EmployeeId, LeaderId, PTOType, StartDate, EndDate, Status, Comments, LastUpdated, DateSubmitted) VALUES(${requestId}, ${currentUserID}, ${leaderId}, '${reqType}', ${startDate}, ${endDate}, '${reqStatus}', '${comments}', '${dateTimeUTC}', '${dateTimeUTC}')`
                connection.query(sql);
            }
        });

});

app.get("/report",(req,res)=>{
    let currentUserID = req.session.username;

    connection.query('SELECT e.FirstName, e.LastName, e.role, e.PtoBalanceVacation, e.PtoBalancePersonal, e.PtoBalanceSick, pto.MaxVacation, pto.MaxPersonal, pto.MaxSick FROM employees e, PTO pto WHERE e.EmployeeId = ? AND e.Role = pto.Role AND pto.NumberOfYears = 0',
        [currentUserID], function(error, results, fields) {
            if(error){
                console.log(error);
            }
            if( results.length === 0 ) {
                console.log('This user ID does not exist!');
            }
            else {
                console.log(results[0])
                res.render('Report', results[0])
            }
        });
});
app.get("/employeeList",(req,res)=>{
    let username = req.session.username;
    connection.query('SELECT * FROM employees WHERE LeaderId = ?', [username], function(error, results, fields) {

        if (error) throw error;

        let string = JSON.stringify(results);
        let json = JSON.parse(string);
        for (let index in json) {
            var obj = json[index];
            for (objectIndex in obj) {
                if (objectIndex != "PROJ_ALLOC_NO") {
                    if (objectIndex === "HireDate") {
                        obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0, 10);
                    }

                }
            }
        }
        res.render('EmployeeList', {
            data: json
        })
    })
});
app.get("/seeReport",(req,res)=>{
    //Get currently authed user's ID
    let currentUserID = req.session.username;
    //console.log(currentUserID);

    //Query the employee information of currently logged-in user as well as currently set max PTO days
    connection.query('SELECT e.FirstName, e.LastName, e.role, e.PtoBalanceVacation, e.PtoBalancePersonal, e.PtoBalanceSick, pto.MaxVacation, pto.MaxPersonal, pto.MaxSick FROM employees e, PTO pto WHERE e.EmployeeId = ? AND e.Role = pto.Role AND pto.NumberOfYears = 0',
        [currentUserID], function(error, results, fields) {
            if(error){
                console.log(error);
            }
            if( results.length === 0 ) {
                console.log('This user ID does not exist!');
            }
            else {
                res.render('seeReport', results[0])
            }
        });

});
app.get("/pending",(req,res)=>{
    let currentUserID = req.session.username;

    connection.query('SELECT r.*, e.FirstName FROM employees e, requests r WHERE r.EmployeeId = e.EmployeeId AND r.LeaderId = ?',
        [currentUserID], function(error, results, fields) {
            if(error){
                console.log(error);
            }
            if( results.length === 0 ) {
                console.log('This user ID does not exist!');
                res.render('PendingReq', {
                    data: {}
                })
            }
            else {
                //console.log(results[0].RequestId)
                //console.log('>> results: ', results );
                let string = JSON.stringify(results);
                //console.log('>> string: ', string );
                let json =  JSON.parse(string);
                console.log('>> json: ', json);
                //req.list = json;
                //next();

                for(let index in json) {
                    var obj = json[index];
                    for(objectIndex in obj) {
                        if(objectIndex != "PROJ_ALLOC_NO") {
                            // Only alert if the key of the object is not PROJ_ALLOC_NO
                            //console.log(objectIndex)
                            if (objectIndex === "StartDate")
                            {
                                obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0,10).slice(5, 10);
                            }
                            if (objectIndex === "EndDate")
                            {
                                obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0,10).slice(5, 10);
                            }
                            //console.log(objectIndex + ": " + obj[objectIndex]);
                        }
                    }
                }
                res.render('PendingReq', {
                    data: json
                })
            }
        });
});
app.get("/details",(req,res)=>{
    res.render('viewDetails')
});
app.get("/manSchedule",(req,res)=>{
    let username = req.session.username;
    connection.query('SELECT e.FirstName, r.PTOType, r.StartDate, r.EndDate, r.Status, r.DateSubmitted FROM (requests r JOIN employees e ON r.employeeId = e.employeeId) WHERE e.employeeId = ?', [username], function(error, results, fields) {

        if (error) throw error;

        let string=JSON.stringify(results);
        let json =  JSON.parse(string);
        for(let index in json) {
            var obj = json[index];
            for(objectIndex in obj) {
                if (objectIndex != "PROJ_ALLOC_NO") {
                    // if (objectIndex === "StartDate") {
                    //     obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0, 10).slice(5, 10);
                    // }
                    // if (objectIndex === "EndDate") {
                    //     obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0, 10).slice(5, 10);
                    // }
                    if (objectIndex === "DateSubmitted") {
                        obj[objectIndex] = obj[objectIndex].replace("-", "/").replace("-", "/").slice(0, 10).slice(5, 10);
                    }
                }
            }
        }
        res.render('manSchedule', {
            data: json
        })

    });
});
app.get("/create",(req,res)=>{
    let data = {
        noUserID: req.flash('noUserID'),
        alreadyReg: req.flash('alreadyReg'),
        passNoMatch: req.flash('passNoMatch'),
    };
    res.render('Create', data)
});

app.post("/register", (request, response) => {
    let usernameReg = request.body.usernameReg;
    let passwordReg = request.body.passwordReg;
    let passwordConfirmReg = request.body.passwordConfirmReg;
    let password = request.session.password;

    connection.query('SELECT EmployeeId FROM employees WHERE EmployeeId  = ?', [usernameReg], function(error, results, fields) {
        if(error){
            console.log(error)
        }

        if( results.length === 0 ) {
            request.flash('noUserID', 'This User ID Does Not Exist!');
            response.redirect('create');
        }else {
            connection.query('SELECT UID FROM Login WHERE UID  = ?', [usernameReg], function(error, results, fields) {
                if(error){
                    console.log(error)
                }

                if( results.length > 0 ) {
                    request.flash('alreadyReg', 'This User ID is Already Registered');
                    response.redirect('create');

                } else if(results.length === 0){
                    if(passwordReg !== passwordConfirmReg) {
                        request.flash('passNoMatch', 'Passwords Do Mot Match');
                        response.redirect('create');
                    }else{
                        connection.query('INSERT INTO Login SET?', {UID: usernameReg, Password:passwordReg}, (err, result) => {
                            if(err) {
                                console.log(err)
                            } else {
                                response.render('Home');
                            }
                        })
                    }

                }
            })
        }

    })
        // let hashedPassword = await bcrypt.hash(passwordReg, 8)
        //
        // console.log(hashedPassword)
    })

app.get("/forgot",(req,res)=>{
    let data = {
        noUserID: req.flash('noUserID'),
        passNoMatch: req.flash('passNoMatch'),
    };
    res.render('Forgot', data)
});

app.post("/changePass", (request, response) => {
    let usernameReg = request.body.usernameReg;
    let passwordReg = request.body.passwordReg;
    let passwordConfirmReg = request.body.passwordConfirmReg;

    connection.query('SELECT EmployeeId FROM employees WHERE EmployeeId  = ?', [usernameReg], function(error, results, fields) {
        if(error){
            console.log(error)
        }

        if( results.length === 0 ) {
            request.flash('noUserID', 'This User ID Does Not Exist!');
            response.redirect('forgot');

        } else if(results.length > 0 ){
            if(passwordReg !== passwordConfirmReg) {
                request.flash('passNoMatch', 'Passwords Do Mot Match');
                response.redirect('forgot');
            }else {
                connection.query('DELETE FROM Login WHERE UID = ?', [usernameReg], function (error, results, fields) {
                    if (error) {
                        console.log(error)
                    }
                    connection.query('INSERT INTO Login SET?', {
                        UID: usernameReg,
                        Password: passwordReg
                    }, (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            response.render('Home');
                        }
                    })
                })
            }
        }
    })
    // let hashedPassword = await bcrypt.hash(passwordReg, 8)
    //
    // console.log(hashedPassword)
})


let port= 3006;
app.listen(port, ()=>{
    console.log(`Listening on http://localhost:${port}/home`);
})

