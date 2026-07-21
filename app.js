const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");
const mysql = require("mysql2");

const app = express();
const PORT = 3000;

// =====================================================
// DATABASE CONNECTION
// =====================================================
const db = mysql.createConnection({
    host: "c237-meilan-mysql.mysql.database.azure.com",
    user: "c237_010",
    password: "c237010@2026!",
    database: "c237_010_team2_ca2_project",
    ssl: { rejectUnauthorized: false }
});

db.connect(error => error ? console.error("Database connection failed:", error.message) : console.log("Connected to MySQL database successfully"));

// =====================================================
// EXPRESS SETTINGS
// =====================================================
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("resources/public"));

// Support the original stylesheet URLs used by the existing EJS pages.
app.use(express.static("resources"));
app.use("/resources", express.static("resources"));

app.use(session({
    secret: "student-project-management-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.successMessages = req.flash("success");
    res.locals.errorMessages = req.flash("error");
    next();
});

// =====================================================
// MULTER CONFIGURATION
// =====================================================
const allowedImageTypes = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const profileStorage = multer.diskStorage({
    destination: "resources/public/images/profile-pictures",
    filename: (req, file, callback) => callback(null, "profile-" + Date.now() + "-" + Math.round(Math.random() * 1000000000) + allowedImageTypes[file.mimetype])
});

const uploadProfilePicture = multer({
    storage: profileStorage,
    fileFilter: (req, file, callback) => allowedImageTypes[file.mimetype] ? callback(null, true) : callback(new Error("Only JPG, PNG and WEBP images are allowed.")),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const allowedResourceTypes = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip"
};

const resourceStorage = multer.diskStorage({
    destination: "resources/public/uploads/resources",
    filename: (req, file, callback) => callback(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_"))
});

const uploadResource = multer({
    storage: resourceStorage,
    fileFilter: (req, file, callback) => allowedResourceTypes[file.mimetype] ? callback(null, true) : callback(new Error("That file type is not allowed.")),
    limits: { fileSize: 20 * 1024 * 1024 }
});

// =====================================================
// OPTIONS AND VALIDATION
// =====================================================
const diplomaOptions = [
    "Common ICT Programme (R58)", "Diploma in Applied AI & Analytics (R13)",
    "Diploma in Cybersecurity & Digital Forensics (R55)", "Diploma in Enterprise Cloud Computing & Management (R12)",
    "Diploma in Financial Technology (R18)", "Diploma in Information Technology (R47)"
];

const yearSemesterOptions = [
    "Year 1 Semester 1", "Year 1 Semester 2", "Year 2 Semester 1",
    "Year 2 Semester 2", "Year 3 Semester 1", "Year 3 Semester 2"
];

const cleanText = value => String(value || "").trim();
const isValidPriority = priority => ["Low", "Medium", "High"].includes(priority);
const isValidTaskStatus = status => ["Not Started", "In Progress", "Completed"].includes(status);
const isValidBucket = bucketType => ["went_well", "improvement", "thanks"].includes(bucketType);

// =====================================================
// DATABASE HELPERS
// =====================================================
function getUserById(userId, callback) {
    const sql = `SELECT user_id AS userId, username, password, name, email, contact_number AS contactNumber, diploma, year_semester AS yearSemester, bio, profile_picture AS profilePicture FROM users WHERE user_id = ? LIMIT 1`;
    db.query(sql, [userId], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function getUserByEmail(email, callback) {
    const sql = `SELECT user_id AS userId, username, password, name, email, contact_number AS contactNumber, diploma, year_semester AS yearSemester, bio, profile_picture AS profilePicture FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`;
    db.query(sql, [email], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function getUserByUsername(username, callback) {
    const sql = `SELECT user_id AS userId FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`;
    db.query(sql, [username], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function getProjectContext(projectId, userId, callback) {
    const sql = `SELECT p.project_id AS projectId, p.project_name AS projectName, p.description, pm.role FROM projects p INNER JOIN project_members pm ON p.project_id = pm.project_id WHERE p.project_id = ? AND pm.user_id = ? LIMIT 1`;
    db.query(sql, [projectId, userId], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function getProjectMembers(projectId, callback) {
    const sql = `SELECT u.user_id AS userId, u.username, u.name, u.email, u.contact_number AS contactNumber, u.diploma, u.year_semester AS yearSemester, u.bio, u.profile_picture AS profilePicture, pm.role FROM project_members pm INNER JOIN users u ON pm.user_id = u.user_id WHERE pm.project_id = ? ORDER BY CASE WHEN pm.role = 'Project Leader' THEN 0 ELSE 1 END, u.name`;
    db.query(sql, [projectId], (error, results) => error ? callback(error) : callback(null, results));
}

function getTaskById(taskId, projectId, callback) {
    const sql = `SELECT t.task_id AS taskId, t.project_id AS projectId, t.task_name AS taskName, t.description, t.assigned_user_id AS assignedUserId, t.created_by_user_id AS createdByUserId, t.priority, t.status, DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate, t.created_at AS createdAt, t.updated_at AS updatedAt, u.name AS assignedUserName FROM tasks t LEFT JOIN users u ON t.assigned_user_id = u.user_id WHERE t.task_id = ? AND t.project_id = ? LIMIT 1`;
    db.query(sql, [taskId, projectId], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function getMeetingById(meetingId, projectId, callback) {
    const sql = `SELECT meeting_id AS meetingId, project_id AS projectId, meeting_title AS meetingTitle, DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate, TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime, location, agenda, created_by_user_id AS createdByUserId FROM meetings WHERE meeting_id = ? AND project_id = ? LIMIT 1`;
    db.query(sql, [meetingId, projectId], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function getRetrospectiveById(retrospectiveId, projectId, callback) {
    const sql = `SELECT retrospective_id AS retrospectiveId, project_id AS projectId, user_id AS userId, bucket_type AS bucketType, content FROM retrospective_items WHERE retrospective_id = ? AND project_id = ? LIMIT 1`;
    db.query(sql, [retrospectiveId, projectId], (error, results) => error ? callback(error) : callback(null, results[0] || null));
}

function addActivity(projectId, userId, description, callback) {
    db.query(`INSERT INTO activities (project_id, user_id, description) VALUES (?, ?, ?)`, [projectId, userId, description], error => error ? callback(error) : callback(null));
}

// =====================================================
// LOAD CURRENT USER AND PROJECT
// =====================================================
app.use((req, res, next) => {
    res.locals = { ...res.locals, currentUser: null, selectedProject: null, currentProjectRole: null, diplomaOptions, yearSemesterOptions };
    if (!req.session.userId) return next();

    getUserById(req.session.userId, (userError, currentUser) => {
        if (userError) return next(userError);
        if (!currentUser) { req.session.userId = null; req.session.selectedProjectId = null; return next(); }
        res.locals.currentUser = currentUser;
        if (!req.session.selectedProjectId) return next();

        getProjectContext(req.session.selectedProjectId, currentUser.userId, (projectError, projectContext) => {
            if (projectError) return next(projectError);
            if (!projectContext) { req.session.selectedProjectId = null; return next(); }
            res.locals.selectedProject = { projectId: projectContext.projectId, projectName: projectContext.projectName, description: projectContext.description };
            res.locals.currentProjectRole = projectContext.role;
            next();
        });
    });
});

// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================
const requireLogin = (req, res, next) => !res.locals.currentUser ? (req.flash("error", "Please log in before accessing that page."), res.redirect("/login")) : next();
const requireSelectedProject = (req, res, next) => !res.locals.selectedProject ? (req.flash("error", "Please select a project first."), res.redirect("/projects")) : next();
const requireProjectLeader = (req, res, next) => res.locals.currentProjectRole !== "Project Leader" ? (req.flash("error", "Only the Project Leader can perform that action."), res.redirect("/dashboard")) : next();

// =====================================================
// HOME, LOGIN AND LOGOUT
// =====================================================
app.get("/", (req, res) => !res.locals.currentUser ? res.redirect("/login") : (!res.locals.selectedProject ? res.redirect("/projects") : res.redirect("/dashboard")));
app.get("/login", (req, res) => res.locals.currentUser ? res.redirect("/projects") : res.render("login"));

app.post("/login", (req, res, next) => {
    const username = cleanText(req.body.username), password = String(req.body.password || "");
    const sql = `SELECT user_id AS userId, username, password, name FROM users WHERE LOWER(username) = LOWER(?) AND password = ? LIMIT 1`;
    db.query(sql, [username, password], (error, results) => {
        if (error) return next(error);
        if (!results[0]) { req.flash("error", "The username or password is incorrect."); return res.redirect("/login"); }
        req.session.userId = results[0].userId;
        req.session.selectedProjectId = null;
        req.flash("success", "Welcome, " + results[0].name + ".");
        res.redirect("/projects");
    });
});

// Log the user out.
app.get('/logout', requireLogin, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Unable to log out.');
        }

        // Redirect the user to the login page.
        res.redirect('/login');
    });
});

// =====================================================
// REGISTER
// =====================================================
app.get("/register", (req, res) => res.locals.currentUser ? res.redirect("/projects") : res.render("register"));

app.post("/register", uploadProfilePicture.single("profilePicture"), (req, res, next) => {
    const username = cleanText(req.body.username), name = cleanText(req.body.name), email = cleanText(req.body.email).toLowerCase();
    const password = String(req.body.password || ""), confirmPassword = String(req.body.confirmPassword || "");
    const contactNumber = cleanText(req.body.contactNumber), diploma = cleanText(req.body.diploma), yearSemester = cleanText(req.body.yearSemester), bio = cleanText(req.body.bio);

    if (!username || !name || !email || !password || !confirmPassword || !diploma || !yearSemester) { req.flash("error", "Please complete every required field."); return res.redirect("/register"); }
    if (password.length < 8) { req.flash("error", "Your password must contain at least eight characters."); return res.redirect("/register"); }
    if (password !== confirmPassword) { req.flash("error", "The passwords do not match."); return res.redirect("/register"); }

    getUserByUsername(username, (usernameError, existingUsername) => {
        if (usernameError) return next(usernameError);
        if (existingUsername) { req.flash("error", "That username is already taken."); return res.redirect("/register"); }

        getUserByEmail(email, (emailError, existingEmail) => {
            if (emailError) return next(emailError);
            if (existingEmail) { req.flash("error", "That email is already registered."); return res.redirect("/register"); }

            const profilePicture = req.file ? "/images/profile-pictures/" + req.file.filename : "/images/profile-pictures/default-profile.svg";
            const values = [username, password, name, email, contactNumber, diploma, yearSemester, bio, profilePicture];

            db.query(`INSERT INTO users (username, password, name, email, contact_number, diploma, year_semester, bio, profile_picture) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, values, insertError => {
                if (insertError) return next(insertError);
                req.flash("success", "Your account has been created. Please log in.");
                res.redirect("/login");
            });
        });
    });
});

// =====================================================
// PROJECT SELECTION & CRUD
// =====================================================
app.get("/projects", requireLogin, function (req, res, next) {
    const userId = res.locals.currentUser.userId;
    const sql = "SELECT p.project_id AS projectId, p.project_name AS projectName, p.description, p.endDate, p.status, pm.role FROM project_members pm INNER JOIN projects p ON pm.project_id = p.project_id WHERE pm.user_id = ? AND p.status != 'Archived' ORDER BY p.project_name";

    db.query(sql, [userId], function (error, userProjects) {
        if (error) {
            return next(error);
        } else {
            res.render("projectselection", { userProjects: userProjects });
        }
    });
});

app.post("/projects/select", requireLogin, function (req, res, next) {
    const projectId = Number(req.body.projectId);
    const userId = res.locals.currentUser.userId;

    getProjectContext(projectId, userId, function (error, projectContext) {
        if (error) {
            return next(error);
        } else {
            if (!projectContext) {
                req.flash("error", "You are not a member of that project.");
                return res.redirect("/projects");
            } else {
                req.session.selectedProjectId = projectId;
                // Show the reminder popup once when this project is opened.
                req.session.remindersSeen = false;
                req.flash("success", "Project selected successfully.");
                res.redirect("/dashboard");
            }
        }
    });
});

//Show project form
app.get('/addproject', requireLogin, function (req, res) {
    res.render('addproject');
});

//Submit project
app.post('/addproject', requireLogin, function (req, res, next) {
    const name = req.body.projectName;
    const desc = req.body.description;
    const userId = res.locals.currentUser.userId;

    const sqlProject = "INSERT INTO projects (project_name, description, endDate, status, created_by_user_id) VALUES (?, ?, ?, 'Active', ?)";
    db.query(sqlProject, [name, desc, req.body.endDate, userId], function (error, result) {
        if (error) {
            return next(error);
        } else {
            const newProjectId = result.insertId;
            const sqlMember = "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Project Leader')";
            db.query(sqlMember, [newProjectId, userId], function (memberError) {
                if (memberError) {
                    return next(memberError);
                } else {
                    req.flash("success", "Project created and leadership assigned successfully!");
                    res.redirect("/projects");
                }
            });
        }
    });
});

app.get('/editproject/:id', requireLogin, function (req, res, next) {
    const projectId = req.params.id;
    const sql = "SELECT project_id AS projectId, project_name AS projectName, description, endDate FROM projects WHERE project_id = ?";

    db.query(sql, [projectId], function (error, results) {
        if (error) return next(error);
        const projectData = results[0];
        res.render("editproject", { project: projectData });
    });
});

app.post('/editproject/:id', requireLogin, requireProjectLeader, function (req, res, next) {
    const projectId = req.params.id;
    const name = req.body.projectName;
    const desc = req.body.description;
    const sqlProject = "UPDATE projects SET project_name = ?, description = ?, endDate = ? WHERE project_id = ?";
    db.query(sqlProject, [name, desc, req.body.endDate, projectId], function (error, result) {
        if (error) return next(error);
        res.redirect("/projects");
    });
});

app.post("/archiveproject/:id", requireLogin, requireProjectLeader, function (req, res, next) {
    const projectId = req.params.id;
    const ArchiveProject = "UPDATE projects SET status = 'Archived' WHERE project_id = ?";
    db.query(ArchiveProject, [projectId], function (error, result) {
        if (error) return next(error);
        res.redirect("/projects");
    });
});

app.get("/archivedprojects", requireLogin, function (req, res, next) {
    const userId = res.locals.currentUser.userId;
    const sql = "SELECT p.project_id AS projectId, p.project_name AS projectName, p.description, p.endDate, p.status, pm.role FROM project_members pm INNER JOIN projects p ON pm.project_id = p.project_id WHERE pm.user_id = ? AND p.status = 'Archived' ORDER BY p.project_name";

    db.query(sql, [userId], function (error, userProjects) {
        if (error) {
            return next(error);
        } else {
            res.render("archivedprojects", { userProjects: userProjects });
        }
    });
});

app.post("/deleteproject/:id", requireLogin, requireProjectLeader, function (req, res, next) {
    const projectId = req.params.id;
    const DeleteProject = "DELETE FROM projects WHERE project_id = ?";
    db.query(DeleteProject, [projectId], function (error, result) {
        if (error) return next(error);
        res.redirect("/projects");
    });
});

app.post("/restoreproject/:id", requireLogin, requireProjectLeader, function (req, res, next) {
    const projectId = req.params.id;
    const RestoreProject = "UPDATE projects SET status = 'Active' WHERE project_id = ?";
    db.query(RestoreProject, [projectId], function (error, result) {
        if (error) return next(error);
        res.redirect("/projects");
    });
});

// =====================================================
// DASHBOARD
// =====================================================
app.get("/dashboard", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;

    const summarySql = `SELECT COUNT(*) AS totalTasks, SUM(status = 'Completed') AS completedTasks, SUM(status = 'In Progress') AS inProgressTasks FROM tasks WHERE project_id = ?`;

    db.query(summarySql, [projectId], (summaryError, summaryRows) => {
        if (summaryError) return next(summaryError);

        const s = summaryRows[0];
        const total = Number(s.totalTasks || 0);
        const comp = Number(s.completedTasks || 0);
        const prog = Number(s.inProgressTasks || 0);

        const completionPercentage = total > 0 ? Math.round((comp / total) * 100) : 0;
        const teamProductivity = total > 0 ? Math.round(((comp + prog * 0.5) / total) * 100) : 0;

        const usersSql = `SELECT user_id AS userId, username FROM users ORDER BY username`;

        db.query(usersSql, (usersError, users) => {
            if (usersError) return next(usersError);

            const deadlinesSql = `SELECT task_id AS taskId, task_name AS taskName, status, DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate FROM tasks WHERE project_id = ? AND status <> 'Completed' AND due_date >= CURDATE() ORDER BY due_date ASC LIMIT 5`;

            db.query(deadlinesSql, [projectId], (deadlineError, upcomingDeadlines) => {
                if (deadlineError) return next(deadlineError);

                const activitySql = `SELECT activity_id AS activityId, description, created_at AS createdAt FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`;

                db.query(activitySql, [projectId], (activityError, recentActivities) => {
                    if (activityError) return next(activityError);

                    const meetingSql = `SELECT meeting_id AS meetingId, meeting_title AS meetingTitle, DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate, TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime, location, agenda FROM meetings WHERE project_id = ? AND YEARWEEK(meeting_date, 1) = YEARWEEK(CURDATE(), 1) ORDER BY meeting_date, meeting_time`;

                    db.query(meetingSql, [projectId], (meetingError, meetingsThisWeek) => {
                        if (meetingError) return next(meetingError);

                        const reminderTaskSql = `SELECT task_name AS taskName, priority, DATE_FORMAT(due_date, '%d %b %Y') AS dueDate FROM tasks WHERE project_id = ? AND status <> 'Completed' AND due_date >= CURDATE() ORDER BY due_date LIMIT 5`;
                        db.query(reminderTaskSql, [projectId], (reminderTaskError, reminderTasks) => {
                            if (reminderTaskError) return next(reminderTaskError);

                            const reminderMeetingSql = `SELECT meeting_title AS meetingTitle, DATE_FORMAT(meeting_date, '%d %b %Y') AS meetingDate, TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime FROM meetings WHERE project_id = ? AND meeting_date >= CURDATE() ORDER BY meeting_date LIMIT 5`;
                            db.query(reminderMeetingSql, [projectId], (reminderMeetingError, reminderMeetings) => {
                                if (reminderMeetingError) return next(reminderMeetingError);

                                const reminders = reminderTasks.map(task => ({
                                    title: task.taskName,
                                    message: "Due " + task.dueDate + " - " + task.priority + " priority",
                                    type: "task"
                                })).concat(reminderMeetings.map(meeting => ({
                                    title: meeting.meetingTitle,
                                    message: meeting.meetingDate + " at " + meeting.meetingTime,
                                    type: "meeting"
                                })));

                                const showRemindersPopup = !req.session.remindersSeen && reminders.length > 0;
                                if (showRemindersPopup) req.session.remindersSeen = true;

                                res.render("dashboard", {
                                    user: res.locals.currentUser,
                                    selectedProject: res.locals.selectedProject,
                                    currentProjectRole: res.locals.currentProjectRole,
                                    dashboard: { completionPercentage, teamProductivity, totalTasks: total },
                                    upcomingDeadlines,
                                    recentActivities,
                                    meetingsThisWeek,
                                    users,
                                    reminders,
                                    showRemindersPopup,
                                    notificationCount: recentActivities.length
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
// =====================================================
// PROJECT MEMBERS
// =====================================================
app.post("/projects/:id/assignmember", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    const userId = Number(req.body.userId);
    const AssignMemberSql = "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Project Member')";
    db.query(AssignMemberSql, [projectId, userId], (error) => {
        if (error) return next(error);
        res.redirect("/dashboard");
    });
});

// Every project member may view the team list.
app.get("/project-members", requireLogin, requireSelectedProject, (req, res, next) => {
    getProjectMembers(res.locals.selectedProject.projectId, (error, members) => {
        if (error) return next(error);
        res.render("userlist", { members, diplomaOptions, yearSemesterOptions });
    });
});
// =====================================================
// PROFILE
// =====================================================
app.get("/profile", requireLogin, (req, res) => res.render("profile", { user: res.locals.currentUser }));
app.get("/profile/edit", requireLogin, (req, res) => res.render("editprofile", { user: res.locals.currentUser, diplomaOptions, yearSemesterOptions }));

app.post("/profile/edit", requireLogin, uploadProfilePicture.single("profilePicture"), (req, res, next) => {
    const currentUser = res.locals.currentUser, name = cleanText(req.body.name), email = cleanText(req.body.email).toLowerCase();
    if (!name || !email) { req.flash("error", "Name and email are required."); return res.redirect("/profile/edit"); }

    getUserByEmail(email, (emailError, existingUser) => {
        if (emailError) return next(emailError);
        if (existingUser && existingUser.userId !== currentUser.userId) { req.flash("error", "That email is already used by another user."); return res.redirect("/profile/edit"); }
        const pic = req.file ? "/images/profile-pictures/" + req.file.filename : currentUser.profilePicture;
        const values = [name, email, cleanText(req.body.contactNumber), cleanText(req.body.diploma), cleanText(req.body.yearSemester), cleanText(req.body.bio), pic, currentUser.userId];

        db.query(`UPDATE users SET name = ?, email = ?, contact_number = ?, diploma = ?, year_semester = ?, bio = ?, profile_picture = ? WHERE user_id = ?`, values, updateError => {
            if (updateError) return next(updateError);
            req.flash("success", "Your profile has been updated.");
            res.redirect("/profile");
        });
    });
});

app.get("/profile/change-password", requireLogin, (req, res) => res.render("changepassword", { user: res.locals.currentUser }));
app.post("/profile/change-password", requireLogin, (req, res, next) => {
    const cur = res.locals.currentUser, oldP = String(req.body.currentPassword || ""), newP = String(req.body.newPassword || ""), confP = String(req.body.confirmPassword || "");
    if (!oldP || !newP || !confP) { req.flash("error", "Please complete every password field."); return res.redirect("/profile/change-password"); }
    if (oldP !== cur.password) { req.flash("error", "The current password is incorrect."); return res.redirect("/profile/change-password"); }
    if (newP.length < 8) { req.flash("error", "The new password must contain at least eight characters."); return res.redirect("/profile/change-password"); }
    if (newP !== confP) { req.flash("error", "The new passwords do not match."); return res.redirect("/profile/change-password"); }
    if (newP === oldP) { req.flash("error", "The new password must be different from the current password."); return res.redirect("/profile/change-password"); }

    db.query(`UPDATE users SET password = ? WHERE user_id = ?`, [newP, cur.userId], error => error ? next(error) : (req.flash("success", "Your password has been changed."), res.redirect("/profile")));
});

// =====================================================
// TASKS
// =====================================================
app.get("/tasks", requireLogin, requireSelectedProject, (req, res, next) => {
    const sql = `
        SELECT t.task_id AS taskId, t.task_name AS taskName, t.description,
               t.priority, t.status,
               DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
               COALESCE(u.name, 'Unassigned') AS assignedUserName
        FROM tasks t
        LEFT JOIN users u ON t.assigned_user_id = u.user_id
        WHERE t.project_id = ?
        ORDER BY t.due_date, t.task_name
    `;
    db.query(sql, [res.locals.selectedProject.projectId], (error, projectTasks) => error ? next(error) : res.render("tasks", { tasks: projectTasks }));
});

app.get("/addtask", requireLogin, requireSelectedProject, (req, res, next) => {
    getProjectMembers(res.locals.selectedProject.projectId, (error, members) => error ? next(error) : res.render("addtask", { members }));
});

app.post("/addtask", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, taskName = cleanText(req.body.taskName), description = cleanText(req.body.description);
    const assignedUserId = Number(req.body.assignedUserId), priority = cleanText(req.body.priority), status = cleanText(req.body.status), dueDate = cleanText(req.body.dueDate);

    db.query(`SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`, [projectId, assignedUserId], (membershipError, membershipRows) => {
        if (membershipError) return next(membershipError);
        if (!taskName || !dueDate || membershipRows.length === 0) { req.flash("error", "Task name, due date and a valid project member are required."); return res.redirect("/addtask"); }
        if (!isValidPriority(priority) || !isValidTaskStatus(status)) { req.flash("error", "Please select a valid priority and status."); return res.redirect("/addtask"); }

        const values = [projectId, taskName, description, assignedUserId, res.locals.currentUser.userId, priority, status, dueDate];
        db.query(`INSERT INTO tasks (project_id, task_name, description, assigned_user_id, created_by_user_id, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, values, insertError => {
            if (insertError) return next(insertError);
            addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' added the task "' + taskName + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Task added successfully."), res.redirect("/tasks")));
        });
    });
});

app.get("/tasks/:id", requireLogin, requireSelectedProject, (req, res, next) => {
    getTaskById(req.params.id, res.locals.selectedProject.projectId, (error, task) => {
        if (error) return next(error);
        if (!task) { req.flash("error", "Task not found in the selected project."); return res.redirect("/tasks"); }

        const commentSql = `SELECT c.comment_id AS commentId, c.comment, c.created_at AS createdAt, u.name AS userName FROM task_comments c INNER JOIN users u ON c.user_id = u.user_id WHERE c.task_id = ? ORDER BY c.created_at DESC`;
        db.query(commentSql, [task.taskId], (commentError, comments) => {
            if (commentError) return next(commentError);
            res.render("taskdetails", { task: task, assignedUser: task.assignedUserId ? { userId: task.assignedUserId, name: task.assignedUserName } : null, comments });
        });
    });
});

app.post("/tasks/:id/comment", requireLogin, requireSelectedProject, (req, res, next) => {
    const taskId = Number(req.params.id), comment = cleanText(req.body.comment);
    if (!comment) { req.flash("error", "Comment cannot be empty."); return res.redirect("/tasks/" + taskId); }

    getTaskById(taskId, res.locals.selectedProject.projectId, (taskError, task) => {
        if (taskError) return next(taskError);
        if (!task) { req.flash("error", "Task not found in the selected project."); return res.redirect("/tasks"); }

        db.query(`INSERT INTO task_comments (task_id, user_id, comment) VALUES (?, ?, ?)`, [taskId, res.locals.currentUser.userId, comment], insertError => {
            if (insertError) return next(insertError);
            req.flash("success", "Comment added.");
            res.redirect("/tasks/" + taskId);
        });
    });
});

app.get("/tasks/:id/edit", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    getTaskById(req.params.id, projectId, (taskError, task) => {
        if (taskError) return next(taskError);
        if (!task) { req.flash("error", "Task not found in the selected project."); return res.redirect("/tasks"); }
        getProjectMembers(projectId, (memberError, members) => memberError ? next(memberError) : res.render("editTasks", { task, members }));
    });
});

app.post("/tasks/:id/edit", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, taskId = Number(req.params.id), taskName = cleanText(req.body.taskName);
    const assignedUserId = Number(req.body.assignedUserId), priority = cleanText(req.body.priority), status = cleanText(req.body.status), dueDate = cleanText(req.body.dueDate), description = cleanText(req.body.description);

    getTaskById(taskId, projectId, (taskError, task) => {
        if (taskError) return next(taskError);
        if (!task) { req.flash("error", "Task not found in the selected project."); return res.redirect("/tasks"); }

        db.query(`SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`, [projectId, assignedUserId], (membershipError, membershipRows) => {
            if (membershipError) return next(membershipError);
            if (!taskName || !dueDate || membershipRows.length === 0) { req.flash("error", "Please provide valid task information."); return res.redirect("/tasks/" + taskId + "/edit"); }
            if (!isValidPriority(priority) || !isValidTaskStatus(status)) { req.flash("error", "Please select a valid priority and status."); return res.redirect("/tasks/" + taskId + "/edit"); }

            const values = [taskName, description, assignedUserId, priority, status, dueDate, taskId, projectId];
            db.query(`UPDATE tasks SET task_name = ?, description = ?, assigned_user_id = ?, priority = ?, status = ?, due_date = ? WHERE task_id = ? AND project_id = ?`, values, updateError => {
                if (updateError) return next(updateError);
                if (status === "Completed") checkAchievements(assignedUserId);
                addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' updated the task "' + taskName + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Task updated successfully."), res.redirect("/tasks/" + taskId)));
            });
        });
    });
});

// =====================================================
// MEETINGS
// =====================================================
app.get("/meetings", requireLogin, requireSelectedProject, (req, res, next) => {
    const sql = `SELECT meeting_id AS meetingId, meeting_title AS meetingTitle, DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate, TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime, location, agenda FROM meetings WHERE project_id = ? ORDER BY meeting_date, meeting_time`;
    db.query(sql, [res.locals.selectedProject.projectId], (error, projectMeetings) => error ? next(error) : res.render("meetings", { meetings: projectMeetings }));
});

app.get("/meetings/add", requireLogin, requireSelectedProject, requireProjectLeader, (req, res) => res.render("addmeeting"));

app.post("/meetings/add", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, meetingTitle = cleanText(req.body.meetingTitle), meetingDate = cleanText(req.body.meetingDate);
    const meetingTime = cleanText(req.body.meetingTime), location = cleanText(req.body.location), agenda = cleanText(req.body.agenda);
    if (!meetingTitle || !meetingDate || !meetingTime) { req.flash("error", "Meeting title, date and time are required."); return res.redirect("/meetings/add"); }

    const values = [projectId, meetingTitle, meetingDate, meetingTime, location, agenda, res.locals.currentUser.userId];
    db.query(`INSERT INTO meetings (project_id, meeting_title, meeting_date, meeting_time, location, agenda, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, values, insertError => {
        if (insertError) return next(insertError);
        addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' scheduled the meeting "' + meetingTitle + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Meeting scheduled successfully."), res.redirect("/meetings")));
    });
});

app.get("/meetings/:id", requireLogin, requireSelectedProject, (req, res, next) => {
    getMeetingById(req.params.id, res.locals.selectedProject.projectId, (error, meeting) => error ? next(error) : (!meeting ? (req.flash("error", "Meeting not found in the selected project."), res.redirect("/meetings")) : res.render("meetingdetails", { meeting })));
});

app.get("/meetings/:id/edit", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    getMeetingById(req.params.id, res.locals.selectedProject.projectId, (error, meeting) => error ? next(error) : (!meeting ? (req.flash("error", "Meeting not found in the selected project."), res.redirect("/meetings")) : res.render("editmeeting", { meeting })));
});

app.post("/meetings/:id/edit", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, meetingId = Number(req.params.id), meetingTitle = cleanText(req.body.meetingTitle);
    const meetingDate = cleanText(req.body.meetingDate), meetingTime = cleanText(req.body.meetingTime), location = cleanText(req.body.location), agenda = cleanText(req.body.agenda);

    getMeetingById(meetingId, projectId, (meetingError, meeting) => {
        if (meetingError) return next(meetingError);
        if (!meeting) { req.flash("error", "Meeting not found in the selected project."); return res.redirect("/meetings"); }
        if (!meetingTitle || !meetingDate || !meetingTime) { req.flash("error", "Meeting title, date and time are required."); return res.redirect("/meetings/" + meetingId + "/edit"); }

        const values = [meetingTitle, meetingDate, meetingTime, location, agenda, meetingId, projectId];
        db.query(`UPDATE meetings SET meeting_title = ?, meeting_date = ?, meeting_time = ?, location = ?, agenda = ? WHERE meeting_id = ? AND project_id = ?`, values, updateError => {
            if (updateError) return next(updateError);
            addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' updated the meeting "' + meetingTitle + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Meeting updated successfully."), res.redirect("/meetings/" + meetingId)));
        });
    });
});

app.post("/meetings/:id/delete", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, meetingId = Number(req.params.id);
    getMeetingById(meetingId, projectId, (meetingError, meeting) => {
        if (meetingError) return next(meetingError);
        if (!meeting) { req.flash("error", "Meeting not found in the selected project."); return res.redirect("/meetings"); }

        db.query(`DELETE FROM meetings WHERE meeting_id = ? AND project_id = ?`, [meetingId, projectId], deleteError => {
            if (deleteError) return next(deleteError);
            addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' deleted the meeting "' + meeting.meetingTitle + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Meeting deleted successfully."), res.redirect("/meetings")));
        });
    });
});

// =====================================================
// RETROSPECTIVE
// =====================================================
app.get("/retrospective", requireLogin, requireSelectedProject, (req, res, next) => {
    const sql = `SELECT r.retrospective_id AS retrospectiveId, r.user_id AS userId, u.name AS userName, r.bucket_type AS bucketType, r.content, r.created_at AS createdAt FROM retrospective_items r LEFT JOIN users u ON r.user_id = u.user_id WHERE r.project_id = ? ORDER BY r.created_at DESC`;
    db.query(sql, [res.locals.selectedProject.projectId], (error, projectItems) => {
        if (error) return next(error);
        res.render("retrospective", {
            wentWell: projectItems.filter(item => item.bucketType === "went_well"),
            improvements: projectItems.filter(item => item.bucketType === "improvement"),
            thanks: projectItems.filter(item => item.bucketType === "thanks")
        });
    });
});

app.post("/retrospective/add", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, bucketType = cleanText(req.body.bucketType), content = cleanText(req.body.content);
    if (!isValidBucket(bucketType) || !content) { req.flash("error", "Please enter valid retrospective information."); return res.redirect("/retrospective"); }

    db.query(`INSERT INTO retrospective_items (project_id, user_id, bucket_type, content) VALUES (?, ?, ?, ?)`, [projectId, res.locals.currentUser.userId, bucketType, content], insertError => {
        if (insertError) return next(insertError);
        addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + " added a retrospective entry.", activityError => activityError ? next(activityError) : (req.flash("success", "Retrospective entry added."), res.redirect("/retrospective")));
    });
});

app.post("/retrospective/:id/edit", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, retrospectiveId = Number(req.params.id);
    getRetrospectiveById(retrospectiveId, projectId, (itemError, item) => {
        if (itemError) return next(itemError);
        if (!item) { req.flash("error", "Retrospective entry not found."); return res.redirect("/retrospective"); }
        if (res.locals.currentProjectRole !== "Project Leader" && item.userId !== res.locals.currentUser.userId) { req.flash("error", "You can only edit your own retrospective entries."); return res.redirect("/retrospective"); }

        const bucketType = cleanText(req.body.bucketType), content = cleanText(req.body.content);
        if (!isValidBucket(bucketType) || !content) { req.flash("error", "Please enter valid retrospective information."); return res.redirect("/retrospective"); }

        db.query(`UPDATE retrospective_items SET bucket_type = ?, content = ? WHERE retrospective_id = ? AND project_id = ?`, [bucketType, content, retrospectiveId, projectId], updateError => {
            if (updateError) return next(updateError);
            addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + " updated a retrospective entry.", activityError => activityError ? next(activityError) : (req.flash("success", "Retrospective entry updated."), res.redirect("/retrospective")));
        });
    });
});

app.post("/retrospective/:id/delete", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, retrospectiveId = Number(req.params.id);
    getRetrospectiveById(retrospectiveId, projectId, (itemError, item) => {
        if (itemError) return next(itemError);
        if (!item) { req.flash("error", "Retrospective entry not found."); return res.redirect("/retrospective"); }
        if (res.locals.currentProjectRole !== "Project Leader" && item.userId !== res.locals.currentUser.userId) { req.flash("error", "You can only delete your own retrospective entries."); return res.redirect("/retrospective"); }

        db.query(`DELETE FROM retrospective_items WHERE retrospective_id = ? AND project_id = ?`, [retrospectiveId, projectId], deleteError => {
            if (deleteError) return next(deleteError);
            addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + " deleted a retrospective entry.", activityError => activityError ? next(activityError) : (req.flash("success", "Retrospective entry deleted."), res.redirect("/retrospective")));
        });
    });
});

// =====================================================
// ACHIEVEMENTS
// =====================================================
const achievementLabels = {
    first_task_completed: "First Task Completed",
    early_finisher: "Early Finisher",
    no_overdue_tasks: "No Overdue Tasks",
    team_mvp: "Team MVP"
};

function grantAchievement(userId, achievementType) {
    db.query(`SELECT achievement_id FROM achievements WHERE user_id = ? AND achievement_type = ? LIMIT 1`, [userId, achievementType], (error, rows) => {
        if (error || rows.length > 0) return;
        db.query(`INSERT INTO achievements (user_id, achievement_type) VALUES (?, ?)`, [userId, achievementType], insertError => {
            if (insertError) console.error("Achievement insert error:", insertError.message);
        });
    });
}

function checkAchievements(userId) {
    if (!userId) return;

    db.query(`SELECT COUNT(*) AS count FROM tasks WHERE assigned_user_id = ? AND status = 'Completed'`, [userId], (error, rows) => {
        if (error) return;
        const completedCount = Number(rows[0].count || 0);
        if (completedCount >= 1) grantAchievement(userId, "first_task_completed");
        if (completedCount >= 5) grantAchievement(userId, "team_mvp");
    });

    db.query(`SELECT COUNT(*) AS count FROM tasks WHERE assigned_user_id = ? AND status = 'Completed' AND due_date >= CURDATE()`, [userId], (error, rows) => {
        if (!error && Number(rows[0].count || 0) >= 1) grantAchievement(userId, "early_finisher");
    });

    db.query(`SELECT COUNT(*) AS totalCount, SUM(CASE WHEN due_date < CURDATE() AND status <> 'Completed' THEN 1 ELSE 0 END) AS overdueCount FROM tasks WHERE assigned_user_id = ?`, [userId], (error, rows) => {
        if (error) return;
        const totalCount = Number(rows[0].totalCount || 0), overdueCount = Number(rows[0].overdueCount || 0);
        if (totalCount > 0 && overdueCount === 0) grantAchievement(userId, "no_overdue_tasks");
    });
}

app.get("/achievements", requireLogin, (req, res, next) => {
    const userId = res.locals.currentUser.userId;
    db.query(`SELECT achievement_id AS achievementId, achievement_type AS achievementType, earned_at AS earnedAt FROM achievements WHERE user_id = ? ORDER BY earned_at DESC`, [userId], (error, rows) => {
        if (error) return next(error);
        const achievements = rows.map(row => ({ ...row, label: achievementLabels[row.achievementType] || row.achievementType }));
        res.render("achievements", { achievements });
    });
});

// =====================================================
// RESOURCES
// =====================================================
app.get("/resources", requireLogin, requireSelectedProject, (req, res, next) => {
    const sql = `
        SELECT r.resources_id AS resourceId, r.resource_name AS resourceName,
               r.description, r.file_name AS fileName, r.file_type AS fileType,
               DATE_FORMAT(r.uploaded_at, '%Y-%m-%d') AS uploadDate,
               u.name AS uploadedBy
        FROM resources r
        LEFT JOIN users u ON r.uploaded_by_user_id = u.user_id
        WHERE r.project_id = ?
        ORDER BY r.uploaded_at DESC
    `;
    db.query(sql, [res.locals.selectedProject.projectId], (error, resources) => error ? next(error) : res.render("resources", { resources }));
});

app.get("/resources/upload", requireLogin, requireSelectedProject, (req, res) => res.render("addresources"));

app.post("/resources/upload", requireLogin, requireSelectedProject, uploadResource.single("resourceFile"), (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, resourceName = cleanText(req.body.resourceName), description = cleanText(req.body.description);
    if (!resourceName || !req.file) { req.flash("error", "Resource name and file are required."); return res.redirect("/resources/upload"); }

    const fileType = req.file.originalname.split(".").pop().toLowerCase();
    const sql = `
        INSERT INTO resources
            (project_id, resource_name, description, file_name, file_type, uploaded_by_user_id, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [projectId, resourceName, description, req.file.filename, fileType, res.locals.currentUser.userId];
    db.query(sql, values, insertError => {
        if (insertError) return next(insertError);
        addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' uploaded "' + resourceName + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Resource uploaded successfully."), res.redirect("/resources")));
    });
});

app.get("/resources/:id/edit", requireLogin, requireSelectedProject, (req, res, next) => {
    const resourceId = Number(req.params.id), projectId = res.locals.selectedProject.projectId;
    db.query(`SELECT resources_id AS resourceId, resource_name AS resourceName, description, file_name AS fileName, file_type AS fileType FROM resources WHERE resources_id = ? AND project_id = ? LIMIT 1`, [resourceId, projectId], (error, rows) => {
        if (error) return next(error);
        if (rows.length === 0) { req.flash("error", "Resource not found."); return res.redirect("/resources"); }
        res.render("editresources", { resource: rows[0] });
    });
});

app.post("/resources/:id/edit", requireLogin, requireSelectedProject, uploadResource.single("resourceFile"), (req, res, next) => {
    const resourceId = Number(req.params.id), projectId = res.locals.selectedProject.projectId, resourceName = cleanText(req.body.resourceName), description = cleanText(req.body.description);

    db.query(`SELECT file_name AS fileName, file_type AS fileType FROM resources WHERE resources_id = ? AND project_id = ? LIMIT 1`, [resourceId, projectId], (findError, rows) => {
        if (findError) return next(findError);
        if (rows.length === 0) { req.flash("error", "Resource not found."); return res.redirect("/resources"); }

        const fileName = req.file ? req.file.filename : rows[0].fileName;
        const fileType = req.file ? req.file.originalname.split(".").pop().toLowerCase() : rows[0].fileType;

        db.query(`UPDATE resources SET resource_name = ?, description = ?, file_name = ?, file_type = ? WHERE resources_id = ? AND project_id = ?`, [resourceName, description, fileName, fileType, resourceId, projectId], updateError => {
            if (updateError) return next(updateError);
            addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' updated resource "' + resourceName + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Resource updated successfully."), res.redirect("/resources")));
        });
    });
});

app.get("/resources/:id/download", requireLogin, requireSelectedProject, (req, res, next) => {
    const resourceId = Number(req.params.id), projectId = res.locals.selectedProject.projectId;
    db.query(`SELECT file_name AS fileName FROM resources WHERE resources_id = ? AND project_id = ? LIMIT 1`, [resourceId, projectId], (error, rows) => {
        if (error) return next(error);
        if (rows.length === 0) { req.flash("error", "Resource not found."); return res.redirect("/resources"); }
        res.download("resources/public/uploads/resources/" + rows[0].fileName);
    });
});

app.post("/resources/:id/delete", requireLogin, requireSelectedProject, (req, res, next) => {
    const resourceId = Number(req.params.id), projectId = res.locals.selectedProject.projectId;
    db.query(`DELETE FROM resources WHERE resources_id = ? AND project_id = ?`, [resourceId, projectId], deleteError => {
        if (deleteError) return next(deleteError);
        addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + " deleted a resource.", activityError => activityError ? next(activityError) : (req.flash("success", "Resource deleted."), res.redirect("/resources")));
    });
});

// =====================================================
// MEETING ATTENDANCE
// =====================================================
app.get("/meetings/:id/attendance", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    getMeetingById(req.params.id, projectId, (meetingError, meeting) => {
        if (meetingError) return next(meetingError);
        if (!meeting) { req.flash("error", "Meeting not found in the selected project."); return res.redirect("/meetings"); }

        getProjectMembers(projectId, (memberError, members) => {
            if (memberError) return next(memberError);
            db.query(`SELECT user_id AS userId, status FROM attendance WHERE meeting_id = ?`, [meeting.meetingId], (attendanceError, existingRows) => {
                if (attendanceError) return next(attendanceError);
                const existingByUser = {};
                existingRows.forEach(row => { existingByUser[row.userId] = row.status; });
                const membersWithStatus = members.map(member => ({ ...member, attendanceStatus: existingByUser[member.userId] || "Present" }));
                res.render("attendance", { meeting, members: membersWithStatus });
            });
        });
    });
});

app.post("/meetings/:id/attendance", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    getMeetingById(req.params.id, projectId, (meetingError, meeting) => {
        if (meetingError) return next(meetingError);
        if (!meeting) { req.flash("error", "Meeting not found in the selected project."); return res.redirect("/meetings"); }

        getProjectMembers(projectId, (memberError, members) => {
            if (memberError) return next(memberError);

            const saveNext = index => {
                if (index >= members.length) { req.flash("success", "Attendance saved."); return res.redirect("/meetings/" + meeting.meetingId); }
                const member = members[index];
                const submitted = req.body["attendance_" + member.userId];
                const status = ["Present", "Late", "Absent"].includes(submitted) ? submitted : "Present";
                db.query(`INSERT INTO attendance (meeting_id, user_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)`, [meeting.meetingId, member.userId, status], upsertError => upsertError ? next(upsertError) : saveNext(index + 1));
            };
            saveNext(0);
        });
    });
});

// =====================================================
// CALENDAR, TIMELINE, NOTIFICATIONS, REMINDERS
// =====================================================
app.get("/calendar", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    const taskSql = `
        SELECT task_id AS taskId, task_name AS taskName, description,
               priority, status, DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate
        FROM tasks
        WHERE project_id = ?
    `;
    db.query(taskSql, [projectId], (taskError, tasks) => {
        if (taskError) return next(taskError);

        const meetingSql = `
            SELECT meeting_id AS meetingId, meeting_title AS meetingTitle,
                   DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate,
                   TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime, location
            FROM meetings
            WHERE project_id = ?
        `;
        db.query(meetingSql, [projectId], (meetingError, meetings) => {
            if (meetingError) return next(meetingError);

            const taskEvents = tasks.map(task => ({
                id: "task-" + task.taskId,
                title: task.taskName,
                start: task.dueDate,
                allDay: true,
                color: task.status === "Completed" ? "#198754" : task.priority === "High" ? "#dc3545" : task.priority === "Medium" ? "#fd7e14" : "#0d6efd",
                extendedProps: { type: "task", taskId: task.taskId, description: task.description || "No description", priority: task.priority, status: task.status }
            }));
            const meetingEvents = meetings.map(meeting => ({
                id: "meeting-" + meeting.meetingId,
                title: meeting.meetingTitle,
                start: meeting.meetingDate,
                allDay: true,
                color: "#6f42c1",
                extendedProps: { type: "meeting", meetingId: meeting.meetingId, time: meeting.meetingTime, location: meeting.location || "Not specified" }
            }));

            const calendarEventsJson = JSON.stringify(taskEvents.concat(meetingEvents)).replace(/</g, "\\u003c");
            res.render("calendar", { calendarEventsJson });
        });
    });
});

app.get("/timeline", requireLogin, requireSelectedProject, (req, res, next) => {
    // Azure MySQL stores the activity time in UTC, so add 8 hours for Singapore.
    const sql = `
        SELECT description,
               DATE_FORMAT(DATE_ADD(created_at, INTERVAL 8 HOUR), '%d %b %Y, %H:%i SGT') AS time
        FROM activities
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `;
    db.query(sql, [res.locals.selectedProject.projectId], (error, activities) => error ? next(error) : res.render("timeline", { activities }));
});

app.get("/notifications", requireLogin, requireSelectedProject, (req, res, next) => {
    const sql = `SELECT description, DATE_FORMAT(created_at, '%d %b %Y %H:%i') AS time FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT 20`;
    db.query(sql, [res.locals.selectedProject.projectId], (error, rows) => {
        if (error) return next(error);
        const notifications = rows.map(row => ({ title: "Project Activity", message: row.description, time: row.time }));
        res.render("notification", { notifications });
    });
});

app.get("/reminders", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    const taskSql = `SELECT task_name AS taskName, priority, DATE_FORMAT(due_date, '%d %b %Y') AS dueDate FROM tasks WHERE project_id = ? AND status <> 'Completed' AND due_date >= CURDATE() ORDER BY due_date`;
    db.query(taskSql, [projectId], (taskError, tasks) => {
        if (taskError) return next(taskError);
        const meetingSql = `SELECT meeting_title AS meetingTitle, DATE_FORMAT(meeting_date, '%d %b %Y') AS meetingDate, TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime FROM meetings WHERE project_id = ? AND meeting_date >= CURDATE() ORDER BY meeting_date`;
        db.query(meetingSql, [projectId], (meetingError, meetings) => {
            if (meetingError) return next(meetingError);
            const reminders = tasks.map(task => ({ title: task.taskName, message: "Due " + task.dueDate + " • " + task.priority + " priority", type: "task" }))
                .concat(meetings.map(meeting => ({ title: meeting.meetingTitle, message: meeting.meetingDate + " at " + meeting.meetingTime, type: "meeting" })));
            res.render("reminders", { reminders });
        });
    });
});

// =====================================================
// SEARCH
// =====================================================
app.get("/search", requireLogin, requireSelectedProject, (req, res, next) => {
    const query = cleanText(req.query.query);
    if (!query) {
        req.flash("error", "Please enter a search term.");
        return res.redirect("/dashboard");
    }

    const projectId = res.locals.selectedProject.projectId;
    const searchTerm = "%" + query + "%";
    const taskSql = `SELECT task_id AS taskId, task_name AS taskName, description, priority, status, DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate FROM tasks WHERE project_id = ? AND (task_name LIKE ? OR description LIKE ?) ORDER BY due_date`;
    const meetingSql = `SELECT meeting_id AS meetingId, meeting_title AS meetingTitle, agenda, DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate, TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime FROM meetings WHERE project_id = ? AND (meeting_title LIKE ? OR agenda LIKE ?) ORDER BY meeting_date, meeting_time`;

    db.query(taskSql, [projectId, searchTerm, searchTerm], (taskError, tasks) => {
        if (taskError) return next(taskError);
        db.query(meetingSql, [projectId, searchTerm, searchTerm], (meetingError, meetings) => {
            if (meetingError) return next(meetingError);
            res.render("searchResults", { query, tasks, meetings, totalResults: tasks.length + meetings.length });
        });
    });
});

// =====================================================
// RISK MANAGEMENT
// =====================================================
const riskValues = { Low: 1, Medium: 2, High: 3 };
const isValidRiskOption = value => ["Low", "Medium", "High"].includes(value);
const isValidRiskStatus = value => ["Open", "Monitoring", "Resolved"].includes(value);

function calculateRisk(probability, impact) {
    const riskScore = riskValues[probability] * riskValues[impact];
    const riskLevel = riskScore <= 2 ? "Low" : riskScore <= 4 ? "Medium" : riskScore <= 6 ? "High" : "Critical";
    return { riskScore, riskLevel };
}

app.get("/risks", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    const sql = `SELECT r.id AS riskId, r.riskTitle, r.description, r.probability, r.impact, r.riskScore, r.riskLevel, r.contingencyPlan, r.status, u.name AS reporterName FROM risks r INNER JOIN users u ON r.reportedBy = u.user_id WHERE r.projectId = ? ORDER BY FIELD(r.riskLevel, 'Critical', 'High', 'Medium', 'Low'), r.createdAt DESC`;
    db.query(sql, [projectId], (error, risks) => {
        if (error) return next(error);
        const summary = { total: risks.length, open: 0, monitoring: 0, resolved: 0, critical: 0 };
        risks.forEach(risk => {
            if (risk.status === "Open") summary.open++;
            if (risk.status === "Monitoring") summary.monitoring++;
            if (risk.status === "Resolved") summary.resolved++;
            if (risk.riskLevel === "Critical" && risk.status !== "Resolved") summary.critical++;
        });
        res.render("risks", { risks, summary });
    });
});

app.get("/risks/add", requireLogin, requireSelectedProject, (req, res) => res.render("addrisk"));

app.post("/risks/add", requireLogin, requireSelectedProject, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId;
    const riskTitle = cleanText(req.body.riskTitle), description = cleanText(req.body.description);
    const probability = cleanText(req.body.probability), impact = cleanText(req.body.impact);
    const contingencyPlan = cleanText(req.body.contingencyPlan), status = cleanText(req.body.status) || "Open";

    if (!riskTitle || !description || !contingencyPlan || !isValidRiskOption(probability) || !isValidRiskOption(impact) || !isValidRiskStatus(status)) {
        req.flash("error", "Please provide valid risk information.");
        return res.redirect("/risks/add");
    }

    const calculated = calculateRisk(probability, impact);
    const values = [projectId, riskTitle, description, probability, impact, calculated.riskScore, calculated.riskLevel, contingencyPlan, status, res.locals.currentUser.userId];
    db.query(`INSERT INTO risks (projectId, riskTitle, description, probability, impact, riskScore, riskLevel, contingencyPlan, status, reportedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values, insertError => {
        if (insertError) return next(insertError);
        addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' reported the risk "' + riskTitle + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Risk added successfully."), res.redirect("/risks")));
    });
});

app.get("/risks/:riskId/edit", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, riskId = Number(req.params.riskId);
    db.query(`SELECT id AS riskId, riskTitle, description, probability, impact, contingencyPlan, status FROM risks WHERE id = ? AND projectId = ? LIMIT 1`, [riskId, projectId], (error, rows) => {
        if (error) return next(error);
        if (rows.length === 0) { req.flash("error", "Risk not found in the selected project."); return res.redirect("/risks"); }
        res.render("editrisk", { risk: rows[0] });
    });
});

app.post("/risks/:riskId/edit", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, riskId = Number(req.params.riskId);
    const riskTitle = cleanText(req.body.riskTitle), description = cleanText(req.body.description);
    const probability = cleanText(req.body.probability), impact = cleanText(req.body.impact);
    const contingencyPlan = cleanText(req.body.contingencyPlan), status = cleanText(req.body.status);

    if (!riskTitle || !description || !contingencyPlan || !isValidRiskOption(probability) || !isValidRiskOption(impact) || !isValidRiskStatus(status)) {
        req.flash("error", "Please provide valid risk information.");
        return res.redirect("/risks/" + riskId + "/edit");
    }

    const calculated = calculateRisk(probability, impact);
    const values = [riskTitle, description, probability, impact, calculated.riskScore, calculated.riskLevel, contingencyPlan, status, riskId, projectId];
    db.query(`UPDATE risks SET riskTitle = ?, description = ?, probability = ?, impact = ?, riskScore = ?, riskLevel = ?, contingencyPlan = ?, status = ? WHERE id = ? AND projectId = ?`, values, updateError => {
        if (updateError) return next(updateError);
        addActivity(projectId, res.locals.currentUser.userId, res.locals.currentUser.name + ' updated the risk "' + riskTitle + '".', activityError => activityError ? next(activityError) : (req.flash("success", "Risk updated successfully."), res.redirect("/risks")));
    });
});

app.post("/risks/:riskId/resolve", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, riskId = Number(req.params.riskId);
    db.query(`UPDATE risks SET status = 'Resolved' WHERE id = ? AND projectId = ?`, [riskId, projectId], updateError => {
        if (updateError) return next(updateError);
        req.flash("success", "Risk marked as resolved.");
        res.redirect("/risks");
    });
});

app.post("/risks/:riskId/delete", requireLogin, requireSelectedProject, requireProjectLeader, (req, res, next) => {
    const projectId = res.locals.selectedProject.projectId, riskId = Number(req.params.riskId);
    db.query(`DELETE FROM risks WHERE id = ? AND projectId = ?`, [riskId, projectId], deleteError => {
        if (deleteError) return next(deleteError);
        req.flash("success", "Risk deleted.");
        res.redirect("/risks");
    });
});

// =====================================================
// ERROR HANDLING
// =====================================================
app.use((error, req, res, next) => {
    console.error(error);
    if (error instanceof multer.MulterError) {
        req.flash("error", error.code === "LIMIT_FILE_SIZE" ? "The profile picture must not exceed 5 MB." : "The profile picture could not be uploaded.");
        return res.redirect("/profile/edit");
    }
    if (error.message === "Only JPG, PNG and WEBP images are allowed.") { req.flash("error", error.message); return res.redirect("/profile/edit"); }
    if (error.code === "ER_NO_SUCH_TABLE") {
        const tableMatch = String(error.sqlMessage || error.message).match(/Table '[^']+\.([^']+)' doesn't exist/i);
        const tableName = tableMatch ? tableMatch[1] : "unknown";
        return res.status(500).send(`Required database table '${tableName}' is missing. Run database_setup.sql, then restart the application.`);
    }
    if (error.code === "ER_DUP_ENTRY") { req.flash("error", "That value already exists in the database."); return res.redirect(req.get("referer") || "/"); }
    res.status(500).send("An unexpected server error occurred. Check the terminal for details.");
});

app.use((req, res) => res.status(404).send("Page not found."));

app.listen(PORT, () => console.log("Server is running on http://localhost:" + PORT));
