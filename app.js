// ======================================================
// IMPORTS
// ======================================================

const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;


// ======================================================
// DATABASE CONNECTION
// ======================================================

// Put your new database password in the DB_PASSWORD environment variable,
// or replace REPLACE_WITH_YOUR_PASSWORD while testing locally.
const db = mysql.createPool({
    host: "c237-meilan-mysql.mysql.database.azure.com",
    user: "c237_010",
    password: "c237010@2026!",
    database: "c237_010_team_2_testdb",

    ssl: {
        rejectUnauthorized: false
    },

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testDatabaseConnection() {
    let connection;

    try {
        connection = await db.getConnection();

        console.log(
            "Connected to MySQL database successfully"
        );
    } catch (error) {
        console.error(
            "Database connection failed:",
            error.message
        );

        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// ======================================================
// EXPRESS SETTINGS
// ======================================================

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("resources/public"));


// ======================================================
// SESSIONS AND FLASH MESSAGES
// ======================================================

app.use(
    session({
        secret: "student-project-management-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

app.use(flash());

app.use(function (req, res, next) {
    res.locals.successMessages = req.flash("success");
    res.locals.errorMessages = req.flash("error");
    next();
});


// ======================================================
// MULTER CONFIGURATION
// ======================================================

// This folder must exist:
// resources/public/images/profile-pictures

const allowedImageTypes = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

const profileStorage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(
            null,
            "resources/public/images/profile-pictures"
        );
    },

    filename: function (req, file, callback) {
        const extension = allowedImageTypes[file.mimetype];

        const uniqueFilename =
            "profile-" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000000) +
            extension;

        callback(null, uniqueFilename);
    }
});

const uploadProfilePicture = multer({
    storage: profileStorage,

    fileFilter: function (req, file, callback) {
        if (allowedImageTypes[file.mimetype]) {
            callback(null, true);
        } else {
            callback(
                new Error(
                    "Only JPG, PNG and WEBP images are allowed."
                )
            );
        }
    },

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


// ======================================================
// SHARED DROPDOWN OPTIONS
// ======================================================

const diplomaOptions = [
    "Common ICT Programme (R58)",
    "Diploma in Applied AI & Analytics (R13)",
    "Diploma in Cybersecurity & Digital Forensics (R55)",
    "Diploma in Enterprise Cloud Computing & Management (R12)",
    "Diploma in Financial Technology (R18)",
    "Diploma in Information Technology (R47)"
];

const yearSemesterOptions = [
    "Year 1 Semester 1",
    "Year 1 Semester 2",
    "Year 2 Semester 1",
    "Year 2 Semester 2",
    "Year 3 Semester 1",
    "Year 3 Semester 2"
];


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function cleanText(value) {
    return String(value || "").trim();
}

function isValidPriority(priority) {
    return ["Low", "Medium", "High"].includes(priority);
}

function isValidTaskStatus(status) {
    return [
        "Not Started",
        "In Progress",
        "Completed"
    ].includes(status);
}

function isValidBucket(bucketType) {
    return [
        "went_well",
        "improvement",
        "thanks"
    ].includes(bucketType);
}

async function getUserById(userId) {
    const [rows] = await db.query(
        `
        SELECT
            user_id AS userId,
            username,
            password,
            name,
            email,
            contact_number AS contactNumber,
            diploma,
            year_semester AS yearSemester,
            bio,
            profile_picture AS profilePicture,
            created_at AS createdAt,
            updated_at AS updatedAt
        FROM users
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );

    return rows[0] || null;
}

async function getUserByEmail(email) {
    const [rows] = await db.query(
        `
        SELECT
            user_id AS userId,
            username,
            password,
            name,
            email,
            contact_number AS contactNumber,
            diploma,
            year_semester AS yearSemester,
            bio,
            profile_picture AS profilePicture
        FROM users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
        `,
        [email]
    );

    return rows[0] || null;
}

async function getProjectContext(projectId, userId) {
    const [rows] = await db.query(
        `
        SELECT
            p.project_id AS projectId,
            p.project_name AS projectName,
            p.description,
            pm.role
        FROM projects p
        INNER JOIN project_members pm
            ON p.project_id = pm.project_id
        WHERE p.project_id = ?
          AND pm.user_id = ?
        LIMIT 1
        `,
        [projectId, userId]
    );

    return rows[0] || null;
}

async function getProjectMembers(projectId) {
    const [rows] = await db.query(
        `
        SELECT
            u.user_id AS userId,
            u.username,
            u.name,
            u.email,
            u.contact_number AS contactNumber,
            u.diploma,
            u.year_semester AS yearSemester,
            u.bio,
            u.profile_picture AS profilePicture,
            pm.role
        FROM project_members pm
        INNER JOIN users u
            ON pm.user_id = u.user_id
        WHERE pm.project_id = ?
        ORDER BY
            CASE
                WHEN pm.role = 'Project Leader' THEN 0
                ELSE 1
            END,
            u.name
        `,
        [projectId]
    );

    return rows;
}

async function getTaskById(taskId, projectId) {
    const [rows] = await db.query(
        `
        SELECT
            t.task_id AS taskId,
            t.project_id AS projectId,
            t.task_name AS taskName,
            t.description,
            t.assigned_user_id AS assignedUserId,
            t.created_by_user_id AS createdByUserId,
            t.priority,
            t.status,
            DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            u.name AS assignedUserName
        FROM tasks t
        LEFT JOIN users u
            ON t.assigned_user_id = u.user_id
        WHERE t.task_id = ?
          AND t.project_id = ?
        LIMIT 1
        `,
        [taskId, projectId]
    );

    return rows[0] || null;
}

async function getMeetingById(meetingId, projectId) {
    const [rows] = await db.query(
        `
        SELECT
            meeting_id AS meetingId,
            project_id AS projectId,
            meeting_title AS meetingTitle,
            DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate,
            TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime,
            location,
            agenda,
            created_by_user_id AS createdByUserId,
            created_at AS createdAt,
            updated_at AS updatedAt
        FROM meetings
        WHERE meeting_id = ?
          AND project_id = ?
        LIMIT 1
        `,
        [meetingId, projectId]
    );

    return rows[0] || null;
}

async function getRetrospectiveById(
    retrospectiveId,
    projectId
) {
    const [rows] = await db.query(
        `
        SELECT
            retrospective_id AS retrospectiveId,
            project_id AS projectId,
            user_id AS userId,
            bucket_type AS bucketType,
            content,
            created_at AS createdAt,
            updated_at AS updatedAt
        FROM retrospective_items
        WHERE retrospective_id = ?
          AND project_id = ?
        LIMIT 1
        `,
        [retrospectiveId, projectId]
    );

    return rows[0] || null;
}

async function addActivity(
    projectId,
    userId,
    description
) {
    await db.query(
        `
        INSERT INTO activities (
            project_id,
            user_id,
            description
        )
        VALUES (?, ?, ?)
        `,
        [projectId, userId, description]
    );
}


// ======================================================
// LOAD CURRENT USER AND PROJECT CONTEXT
// ======================================================

app.use(async function (req, res, next) {
    try {
        res.locals.currentUser = null;
        res.locals.selectedProject = null;
        res.locals.currentProjectRole = null;
        res.locals.diplomaOptions = diplomaOptions;
        res.locals.yearSemesterOptions =
            yearSemesterOptions;

        if (!req.session.userId) {
            return next();
        }

        const currentUser = await getUserById(
            req.session.userId
        );

        if (!currentUser) {
            req.session.userId = null;
            req.session.selectedProjectId = null;
            return next();
        }

        res.locals.currentUser = currentUser;

        if (req.session.selectedProjectId) {
            const projectContext =
                await getProjectContext(
                    req.session.selectedProjectId,
                    currentUser.userId
                );

            if (projectContext) {
                res.locals.selectedProject = {
                    projectId:
                        projectContext.projectId,
                    projectName:
                        projectContext.projectName,
                    description:
                        projectContext.description
                };

                res.locals.currentProjectRole =
                    projectContext.role;
            } else {
                req.session.selectedProjectId = null;
            }
        }

        next();
    } catch (error) {
        next(error);
    }
});


// ======================================================
// AUTHENTICATION AND PERMISSION MIDDLEWARE
// ======================================================

function requireLogin(req, res, next) {
    if (!res.locals.currentUser) {
        req.flash(
            "error",
            "Please log in before accessing that page."
        );

        return res.redirect("/login");
    }

    next();
}

function requireSelectedProject(req, res, next) {
    if (!res.locals.selectedProject) {
        req.flash(
            "error",
            "Please select a project first."
        );

        return res.redirect("/projects");
    }

    next();
}

function requireProjectLeader(req, res, next) {
    if (
        res.locals.currentProjectRole !==
        "Project Leader"
    ) {
        req.flash(
            "error",
            "Only the Project Leader can perform that action."
        );

        return res.redirect("/dashboard");
    }

    next();
}


// ======================================================
// HOME, LOGIN AND LOGOUT ROUTES
// ======================================================

app.get("/", function (req, res) {
    if (!res.locals.currentUser) {
        return res.redirect("/login");
    }

    if (!res.locals.selectedProject) {
        return res.redirect("/projects");
    }

    res.redirect("/dashboard");
});

app.get("/login", function (req, res) {
    if (res.locals.currentUser) {
        return res.redirect("/projects");
    }

    res.render("login");
});

app.post("/login", async function (req, res, next) {
    try {
        const username = cleanText(req.body.username);
        const password = String(req.body.password || "");

        const [rows] = await db.query(
            `
            SELECT
                user_id AS userId,
                username,
                password,
                name
            FROM users
            WHERE LOWER(username) = LOWER(?)
              AND password = ?
            LIMIT 1
            `,
            [username, password]
        );

        const user = rows[0];

        if (!user) {
            req.flash(
                "error",
                "The username or password is incorrect."
            );

            return res.redirect("/login");
        }

        req.session.userId = user.userId;
        req.session.selectedProjectId = null;

        req.flash(
            "success",
            "Welcome, " + user.name + "."
        );

        res.redirect("/projects");
    } catch (error) {
        next(error);
    }
});

app.get("/logout", function (req, res) {
    req.session.userId = null;
    req.session.selectedProjectId = null;

    req.flash(
        "success",
        "You have been logged out."
    );

    res.redirect("/login");
});


// ======================================================
// PROJECT-SELECTION ROUTES
// ======================================================

app.get(
    "/projects",
    requireLogin,
    async function (req, res, next) {
        try {
            const [userProjects] = await db.query(
                `
                SELECT
                    p.project_id AS projectId,
                    p.project_name AS projectName,
                    p.description,
                    pm.role
                FROM project_members pm
                INNER JOIN projects p
                    ON pm.project_id = p.project_id
                WHERE pm.user_id = ?
                ORDER BY p.project_name
                `,
                [res.locals.currentUser.userId]
            );

            res.render("projectselection", {
                userProjects: userProjects
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/projects/select",
    requireLogin,
    async function (req, res, next) {
        try {
            const projectId = Number(req.body.projectId);

            const projectContext =
                await getProjectContext(
                    projectId,
                    res.locals.currentUser.userId
                );

            if (!projectContext) {
                req.flash(
                    "error",
                    "You are not a member of that project."
                );

                return res.redirect("/projects");
            }

            req.session.selectedProjectId = projectId;

            req.flash(
                "success",
                "Project selected successfully."
            );

            res.redirect("/dashboard");
        } catch (error) {
            next(error);
        }
    }
);

// ======================================================
// DASHBOARD ROUTE
// ======================================================

app.get(
    "/dashboard",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const [summaryRows] = await db.query(
                `
                SELECT
                    COUNT(*) AS totalTasks,
                    SUM(status = 'Completed') AS completedTasks,
                    SUM(status = 'In Progress') AS inProgressTasks
                FROM tasks
                WHERE project_id = ?
                `,
                [projectId]
            );

            const summary = summaryRows[0];
            const totalTasks = Number(
                summary.totalTasks || 0
            );
            const completedTasks = Number(
                summary.completedTasks || 0
            );
            const inProgressTasks = Number(
                summary.inProgressTasks || 0
            );

            let completionPercentage = 0;
            let teamProductivity = 0;

            if (totalTasks > 0) {
                completionPercentage = Math.round(
                    (completedTasks / totalTasks) * 100
                );

                teamProductivity = Math.round(
                    (
                        completedTasks +
                        inProgressTasks * 0.5
                    ) /
                    totalTasks *
                    100
                );
            }

            const [upcomingDeadlines] = await db.query(
                `
                SELECT
                    task_id AS taskId,
                    task_name AS taskName,
                    status,
                    DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate
                FROM tasks
                WHERE project_id = ?
                  AND status <> 'Completed'
                  AND due_date >= CURDATE()
                ORDER BY due_date ASC
                LIMIT 5
                `,
                [projectId]
            );

            const [recentActivities] = await db.query(
                `
                SELECT
                    activity_id AS activityId,
                    description,
                    created_at AS createdAt
                FROM activities
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT 5
                `,
                [projectId]
            );

            const [meetingsThisWeek] = await db.query(
                `
                SELECT
                    meeting_id AS meetingId,
                    meeting_title AS meetingTitle,
                    DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate,
                    TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime,
                    location,
                    agenda
                FROM meetings
                WHERE project_id = ?
                  AND YEARWEEK(meeting_date, 1) =
                      YEARWEEK(CURDATE(), 1)
                ORDER BY meeting_date, meeting_time
                `,
                [projectId]
            );

            res.render("dashboard", {
                user: res.locals.currentUser,
                selectedProject:
                    res.locals.selectedProject,
                currentProjectRole:
                    res.locals.currentProjectRole,

                dashboard: {
                    completionPercentage:
                        completionPercentage,
                    teamProductivity:
                        teamProductivity,
                    totalTasks: totalTasks
                },

                upcomingDeadlines:
                    upcomingDeadlines,
                recentActivities:
                    recentActivities,
                meetingsThisWeek:
                    meetingsThisWeek
            });
        } catch (error) {
            next(error);
        }
    }
);


// ======================================================
// PROFILE ROUTES
// ======================================================

app.get(
    "/profile",
    requireLogin,
    function (req, res) {
        res.render("profile", {
            user: res.locals.currentUser
        });
    }
);

app.get(
    "/profile/edit",
    requireLogin,
    function (req, res) {
        res.render("editprofile", {
            user: res.locals.currentUser,
            diplomaOptions: diplomaOptions,
            yearSemesterOptions:
                yearSemesterOptions
        });
    }
);

app.post(
    "/profile/edit",
    requireLogin,
    uploadProfilePicture.single(
        "profilePicture"
    ),
    async function (req, res, next) {
        try {
            const currentUser =
                res.locals.currentUser;

            const name = cleanText(req.body.name);
            const email = cleanText(
                req.body.email
            ).toLowerCase();

            if (!name || !email) {
                req.flash(
                    "error",
                    "Name and email are required."
                );

                return res.redirect("/profile/edit");
            }

            const existingUser =
                await getUserByEmail(email);

            if (
                existingUser &&
                existingUser.userId !==
                currentUser.userId
            ) {
                req.flash(
                    "error",
                    "That email is already used by another user."
                );

                return res.redirect("/profile/edit");
            }

            let profilePicture =
                currentUser.profilePicture;

            if (req.file) {
                profilePicture =
                    "/images/profile-pictures/" +
                    req.file.filename;
            }

            await db.query(
                `
                UPDATE users
                SET
                    name = ?,
                    email = ?,
                    contact_number = ?,
                    diploma = ?,
                    year_semester = ?,
                    bio = ?,
                    profile_picture = ?
                WHERE user_id = ?
                `,
                [
                    name,
                    email,
                    cleanText(
                        req.body.contactNumber
                    ),
                    cleanText(req.body.diploma),
                    cleanText(
                        req.body.yearSemester
                    ),
                    cleanText(req.body.bio),
                    profilePicture,
                    currentUser.userId
                ]
            );

            req.flash(
                "success",
                "Your profile has been updated."
            );

            res.redirect("/profile");
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/profile/change-password",
    requireLogin,
    function (req, res) {
        res.render("changepassword", {
            user: res.locals.currentUser
        });
    }
);

app.post(
    "/profile/change-password",
    requireLogin,
    async function (req, res, next) {
        try {
            const currentUser =
                res.locals.currentUser;

            const currentPassword = String(
                req.body.currentPassword || ""
            );

            const newPassword = String(
                req.body.newPassword || ""
            );

            const confirmPassword = String(
                req.body.confirmPassword || ""
            );

            if (
                !currentPassword ||
                !newPassword ||
                !confirmPassword
            ) {
                req.flash(
                    "error",
                    "Please complete every password field."
                );

                return res.redirect(
                    "/profile/change-password"
                );
            }

            if (
                currentPassword !==
                currentUser.password
            ) {
                req.flash(
                    "error",
                    "The current password is incorrect."
                );

                return res.redirect(
                    "/profile/change-password"
                );
            }

            if (newPassword.length < 8) {
                req.flash(
                    "error",
                    "The new password must contain at least eight characters."
                );

                return res.redirect(
                    "/profile/change-password"
                );
            }

            if (newPassword !== confirmPassword) {
                req.flash(
                    "error",
                    "The new passwords do not match."
                );

                return res.redirect(
                    "/profile/change-password"
                );
            }

            if (newPassword === currentPassword) {
                req.flash(
                    "error",
                    "The new password must be different from the current password."
                );

                return res.redirect(
                    "/profile/change-password"
                );
            }

            await db.query(
                `
                UPDATE users
                SET password = ?
                WHERE user_id = ?
                `,
                [newPassword, currentUser.userId]
            );

            req.flash(
                "success",
                "Your password has been changed."
            );

            res.redirect("/profile");
        } catch (error) {
            next(error);
        }
    }
);


// ======================================================
// PROJECT MEMBER ROUTES
// ======================================================

app.get(
    "/project-members",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const members = await getProjectMembers(
                projectId
            );

            res.render("userlist", {
                members: members,
                diplomaOptions:
                    diplomaOptions,
                yearSemesterOptions:
                    yearSemesterOptions
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/project-members/add",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        let connection;

        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const name = cleanText(req.body.name);
            const email = cleanText(
                req.body.email
            ).toLowerCase();
            const diploma = cleanText(
                req.body.diploma
            );
            const yearSemester = cleanText(
                req.body.yearSemester
            );
            const bio = cleanText(req.body.bio);

            if (!name || !email) {
                req.flash(
                    "error",
                    "Name and email are required."
                );

                return res.redirect(
                    "/project-members"
                );
            }

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [existingUsers] =
                await connection.query(
                    `
                    SELECT
                        user_id AS userId,
                        name
                    FROM users
                    WHERE LOWER(email) = LOWER(?)
                    LIMIT 1
                    `,
                    [email]
                );

            let userId;
            let memberName = name;

            if (existingUsers.length > 0) {
                userId = existingUsers[0].userId;
                memberName = existingUsers[0].name;

                const [memberships] =
                    await connection.query(
                        `
                        SELECT project_id
                        FROM project_members
                        WHERE project_id = ?
                          AND user_id = ?
                        LIMIT 1
                        `,
                        [projectId, userId]
                    );

                if (memberships.length > 0) {
                    await connection.rollback();
                    connection.release();
                    connection = null;

                    req.flash(
                        "error",
                        "That user is already a member of this project."
                    );

                    return res.redirect(
                        "/project-members"
                    );
                }
            } else {
                const usernameBase =
                    email.split("@")[0] || "student";

                const username =
                    usernameBase + Date.now();

                const [insertUserResult] =
                    await connection.query(
                        `
                        INSERT INTO users (
                            username,
                            password,
                            name,
                            email,
                            diploma,
                            year_semester,
                            bio,
                            profile_picture
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        [
                            username,
                            "Temp1234",
                            name,
                            email,
                            diploma,
                            yearSemester,
                            bio,
                            "/images/profile-pictures/default-profile.svg"
                        ]
                    );

                userId = insertUserResult.insertId;
            }

            await connection.query(
                `
                INSERT INTO project_members (
                    project_id,
                    user_id,
                    role
                )
                VALUES (?, ?, 'Project Member')
                `,
                [projectId, userId]
            );

            await connection.query(
                `
                INSERT INTO activities (
                    project_id,
                    user_id,
                    description
                )
                VALUES (?, ?, ?)
                `,
                [
                    projectId,
                    res.locals.currentUser.userId,
                    res.locals.currentUser.name +
                    " added " +
                    memberName +
                    " to the project."
                ]
            );

            await connection.commit();
            connection.release();
            connection = null;

            req.flash(
                "success",
                "Project member added successfully."
            );

            res.redirect("/project-members");
        } catch (error) {
            if (connection) {
                await connection.rollback();
                connection.release();
            }

            next(error);
        }
    }
);

app.post(
    "/project-members/:userId/make-leader",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        let connection;

        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const targetUserId = Number(
                req.params.userId
            );

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [targetRows] =
                await connection.query(
                    `
                    SELECT
                        pm.role,
                        u.name
                    FROM project_members pm
                    INNER JOIN users u
                        ON pm.user_id = u.user_id
                    WHERE pm.project_id = ?
                      AND pm.user_id = ?
                    LIMIT 1
                    `,
                    [projectId, targetUserId]
                );

            if (targetRows.length === 0) {
                await connection.rollback();
                connection.release();
                connection = null;

                req.flash(
                    "error",
                    "That user is not a member of this project."
                );

                return res.redirect(
                    "/project-members"
                );
            }

            if (
                targetRows[0].role ===
                "Project Leader"
            ) {
                await connection.rollback();
                connection.release();
                connection = null;

                req.flash(
                    "error",
                    "That user is already the Project Leader."
                );

                return res.redirect(
                    "/project-members"
                );
            }

            await connection.query(
                `
                UPDATE project_members
                SET role = 'Project Member'
                WHERE project_id = ?
                  AND role = 'Project Leader'
                `,
                [projectId]
            );

            await connection.query(
                `
                UPDATE project_members
                SET role = 'Project Leader'
                WHERE project_id = ?
                  AND user_id = ?
                `,
                [projectId, targetUserId]
            );

            await connection.query(
                `
                INSERT INTO activities (
                    project_id,
                    user_id,
                    description
                )
                VALUES (?, ?, ?)
                `,
                [
                    projectId,
                    res.locals.currentUser.userId,
                    targetRows[0].name +
                    " became the Project Leader."
                ]
            );

            await connection.commit();
            connection.release();
            connection = null;

            req.flash(
                "success",
                "Project Leader role transferred successfully."
            );

            res.redirect("/dashboard");
        } catch (error) {
            if (connection) {
                await connection.rollback();
                connection.release();
            }

            next(error);
        }
    }
);

app.post(
    "/project-members/:userId/remove",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        let connection;

        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const targetUserId = Number(
                req.params.userId
            );

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [targetRows] =
                await connection.query(
                    `
                    SELECT
                        pm.role,
                        u.name
                    FROM project_members pm
                    INNER JOIN users u
                        ON pm.user_id = u.user_id
                    WHERE pm.project_id = ?
                      AND pm.user_id = ?
                    LIMIT 1
                    `,
                    [projectId, targetUserId]
                );

            if (targetRows.length === 0) {
                await connection.rollback();
                connection.release();
                connection = null;

                req.flash(
                    "error",
                    "That user is not a member of this project."
                );

                return res.redirect(
                    "/project-members"
                );
            }

            if (
                targetRows[0].role ===
                "Project Leader"
            ) {
                await connection.rollback();
                connection.release();
                connection = null;

                req.flash(
                    "error",
                    "Transfer the Project Leader role before removing this member."
                );

                return res.redirect(
                    "/project-members"
                );
            }

            await connection.query(
                `
                UPDATE tasks
                SET assigned_user_id = NULL
                WHERE project_id = ?
                  AND assigned_user_id = ?
                `,
                [projectId, targetUserId]
            );

            await connection.query(
                `
                DELETE FROM project_members
                WHERE project_id = ?
                  AND user_id = ?
                `,
                [projectId, targetUserId]
            );

            await connection.query(
                `
                INSERT INTO activities (
                    project_id,
                    user_id,
                    description
                )
                VALUES (?, ?, ?)
                `,
                [
                    projectId,
                    res.locals.currentUser.userId,
                    targetRows[0].name +
                    " was removed from the project."
                ]
            );

            await connection.commit();
            connection.release();
            connection = null;

            req.flash(
                "success",
                "The member was removed from this project only."
            );

            res.redirect("/project-members");
        } catch (error) {
            if (connection) {
                await connection.rollback();
                connection.release();
            }

            next(error);
        }
    }
);

// ======================================================
// TASK ROUTES
// ======================================================

app.get(
    "/tasks",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const [projectTasks] = await db.query(
                `
                SELECT
                    t.task_id AS taskId,
                    t.task_name AS taskName,
                    t.description,
                    t.priority,
                    t.status,
                    DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
                    COALESCE(u.name, 'Unassigned') AS assignedUserName
                FROM tasks t
                LEFT JOIN users u
                    ON t.assigned_user_id = u.user_id
                WHERE t.project_id = ?
                ORDER BY t.due_date, t.task_name
                `,
                [projectId]
            );

            res.render("tasklist", {
                tasks: projectTasks
            });
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/addtask",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const members = await getProjectMembers(
                res.locals.selectedProject.projectId
            );

            res.render("addtask", {
                members: members
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/addtask",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const taskName = cleanText(
                req.body.taskName
            );
            const description = cleanText(
                req.body.description
            );
            const assignedUserId = Number(
                req.body.assignedUserId
            );
            const priority = cleanText(
                req.body.priority
            );
            const status = cleanText(
                req.body.status
            );
            const dueDate = cleanText(
                req.body.dueDate
            );

            const [membershipRows] = await db.query(
                `
                SELECT user_id
                FROM project_members
                WHERE project_id = ?
                  AND user_id = ?
                LIMIT 1
                `,
                [projectId, assignedUserId]
            );

            if (
                !taskName ||
                !dueDate ||
                membershipRows.length === 0
            ) {
                req.flash(
                    "error",
                    "Task name, due date and a valid project member are required."
                );

                return res.redirect("/addtask");
            }

            if (
                !isValidPriority(priority) ||
                !isValidTaskStatus(status)
            ) {
                req.flash(
                    "error",
                    "Please select a valid priority and status."
                );

                return res.redirect("/addtask");
            }

            await db.query(
                `
                INSERT INTO tasks (
                    project_id,
                    task_name,
                    description,
                    assigned_user_id,
                    created_by_user_id,
                    priority,
                    status,
                    due_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    projectId,
                    taskName,
                    description,
                    assignedUserId,
                    res.locals.currentUser.userId,
                    priority,
                    status,
                    dueDate
                ]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                ' added the task "' +
                taskName +
                '".'
            );

            req.flash(
                "success",
                "Task added successfully."
            );

            res.redirect("/tasks");
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/tasks/:id",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const task = await getTaskById(
                req.params.id,
                res.locals.selectedProject.projectId
            );

            if (!task) {
                req.flash(
                    "error",
                    "Task not found in the selected project."
                );

                return res.redirect("/tasks");
            }

            res.render("taskdetails", {
                task: task,
                assignedUser: task.assignedUserId
                    ? {
                        userId:
                            task.assignedUserId,
                        name:
                            task.assignedUserName
                    }
                    : null
            });
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/tasks/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const task = await getTaskById(
                req.params.id,
                projectId
            );

            if (!task) {
                req.flash(
                    "error",
                    "Task not found in the selected project."
                );

                return res.redirect("/tasks");
            }

            const members = await getProjectMembers(
                projectId
            );

            res.render("edittask", {
                task: task,
                members: members
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/tasks/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const taskId = Number(req.params.id);

            const task = await getTaskById(
                taskId,
                projectId
            );

            if (!task) {
                req.flash(
                    "error",
                    "Task not found in the selected project."
                );

                return res.redirect("/tasks");
            }

            const taskName = cleanText(
                req.body.taskName
            );
            const assignedUserId = Number(
                req.body.assignedUserId
            );
            const priority = cleanText(
                req.body.priority
            );
            const status = cleanText(
                req.body.status
            );
            const dueDate = cleanText(
                req.body.dueDate
            );

            const [membershipRows] = await db.query(
                `
                SELECT user_id
                FROM project_members
                WHERE project_id = ?
                  AND user_id = ?
                LIMIT 1
                `,
                [projectId, assignedUserId]
            );

            if (
                !taskName ||
                !dueDate ||
                membershipRows.length === 0
            ) {
                req.flash(
                    "error",
                    "Please provide valid task information."
                );

                return res.redirect(
                    "/tasks/" +
                    taskId +
                    "/edit"
                );
            }

            if (
                !isValidPriority(priority) ||
                !isValidTaskStatus(status)
            ) {
                req.flash(
                    "error",
                    "Please select a valid priority and status."
                );

                return res.redirect(
                    "/tasks/" +
                    taskId +
                    "/edit"
                );
            }

            await db.query(
                `
                UPDATE tasks
                SET
                    task_name = ?,
                    description = ?,
                    assigned_user_id = ?,
                    priority = ?,
                    status = ?,
                    due_date = ?
                WHERE task_id = ?
                  AND project_id = ?
                `,
                [
                    taskName,
                    cleanText(req.body.description),
                    assignedUserId,
                    priority,
                    status,
                    dueDate,
                    taskId,
                    projectId
                ]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                ' updated the task "' +
                taskName +
                '".'
            );

            req.flash(
                "success",
                "Task updated successfully."
            );

            res.redirect("/tasks/" + taskId);
        } catch (error) {
            next(error);
        }
    }
);



// ======================================================
// MEETING ROUTES
// ======================================================

app.get(
    "/meetings",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const [projectMeetings] = await db.query(
                `
                SELECT
                    meeting_id AS meetingId,
                    meeting_title AS meetingTitle,
                    DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate,
                    TIME_FORMAT(meeting_time, '%H:%i') AS meetingTime,
                    location,
                    agenda
                FROM meetings
                WHERE project_id = ?
                ORDER BY meeting_date, meeting_time
                `,
                [projectId]
            );

            res.render("meetings", {
                meetings: projectMeetings
            });
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/meetings/add",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    function (req, res) {
        res.render("addmeeting");
    }
);

app.post(
    "/meetings/add",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const meetingTitle = cleanText(
                req.body.meetingTitle
            );
            const meetingDate = cleanText(
                req.body.meetingDate
            );
            const meetingTime = cleanText(
                req.body.meetingTime
            );
            const location = cleanText(
                req.body.location
            );
            const agenda = cleanText(
                req.body.agenda
            );

            if (
                !meetingTitle ||
                !meetingDate ||
                !meetingTime
            ) {
                req.flash(
                    "error",
                    "Meeting title, date and time are required."
                );

                return res.redirect(
                    "/meetings/add"
                );
            }

            await db.query(
                `
                INSERT INTO meetings (
                    project_id,
                    meeting_title,
                    meeting_date,
                    meeting_time,
                    location,
                    agenda,
                    created_by_user_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    projectId,
                    meetingTitle,
                    meetingDate,
                    meetingTime,
                    location,
                    agenda,
                    res.locals.currentUser.userId
                ]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                ' scheduled the meeting "' +
                meetingTitle +
                '".'
            );

            req.flash(
                "success",
                "Meeting scheduled successfully."
            );

            res.redirect("/meetings");
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/meetings/:id",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const meeting = await getMeetingById(
                req.params.id,
                res.locals.selectedProject.projectId
            );

            if (!meeting) {
                req.flash(
                    "error",
                    "Meeting not found in the selected project."
                );

                return res.redirect("/meetings");
            }

            res.render("meetingdetails", {
                meeting: meeting
            });
        } catch (error) {
            next(error);
        }
    }
);

app.get(
    "/meetings/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const meeting = await getMeetingById(
                req.params.id,
                res.locals.selectedProject.projectId
            );

            if (!meeting) {
                req.flash(
                    "error",
                    "Meeting not found in the selected project."
                );

                return res.redirect("/meetings");
            }

            res.render("editmeeting", {
                meeting: meeting
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/meetings/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const meetingId = Number(req.params.id);

            const meeting = await getMeetingById(
                meetingId,
                projectId
            );

            if (!meeting) {
                req.flash(
                    "error",
                    "Meeting not found in the selected project."
                );

                return res.redirect("/meetings");
            }

            const meetingTitle = cleanText(
                req.body.meetingTitle
            );
            const meetingDate = cleanText(
                req.body.meetingDate
            );
            const meetingTime = cleanText(
                req.body.meetingTime
            );

            if (
                !meetingTitle ||
                !meetingDate ||
                !meetingTime
            ) {
                req.flash(
                    "error",
                    "Meeting title, date and time are required."
                );

                return res.redirect(
                    "/meetings/" +
                    meetingId +
                    "/edit"
                );
            }

            await db.query(
                `
                UPDATE meetings
                SET
                    meeting_title = ?,
                    meeting_date = ?,
                    meeting_time = ?,
                    location = ?,
                    agenda = ?
                WHERE meeting_id = ?
                  AND project_id = ?
                `,
                [
                    meetingTitle,
                    meetingDate,
                    meetingTime,
                    cleanText(req.body.location),
                    cleanText(req.body.agenda),
                    meetingId,
                    projectId
                ]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                ' updated the meeting "' +
                meetingTitle +
                '".'
            );

            req.flash(
                "success",
                "Meeting updated successfully."
            );

            res.redirect(
                "/meetings/" + meetingId
            );
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/meetings/:id/delete",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const meetingId = Number(req.params.id);

            const meeting = await getMeetingById(
                meetingId,
                projectId
            );

            if (!meeting) {
                req.flash(
                    "error",
                    "Meeting not found in the selected project."
                );

                return res.redirect("/meetings");
            }

            await db.query(
                `
                DELETE FROM meetings
                WHERE meeting_id = ?
                  AND project_id = ?
                `,
                [meetingId, projectId]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                ' deleted the meeting "' +
                meeting.meetingTitle +
                '".'
            );

            req.flash(
                "success",
                "Meeting deleted successfully."
            );

            res.redirect("/meetings");
        } catch (error) {
            next(error);
        }
    }
);

// ======================================================
// RETROSPECTIVE ROUTES
// ======================================================

app.get(
    "/retrospective",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;

            const [projectItems] = await db.query(
                `
                SELECT
                    r.retrospective_id AS retrospectiveId,
                    r.user_id AS userId,
                    u.name AS userName,
                    r.bucket_type AS bucketType,
                    r.content,
                    r.created_at AS createdAt
                FROM retrospective_items r
                LEFT JOIN users u
                    ON r.user_id = u.user_id
                WHERE r.project_id = ?
                ORDER BY r.created_at DESC
                `,
                [projectId]
            );

            res.render("retrospective", {
                wentWell: projectItems.filter(
                    function (item) {
                        return (
                            item.bucketType ===
                            "went_well"
                        );
                    }
                ),

                improvements: projectItems.filter(
                    function (item) {
                        return (
                            item.bucketType ===
                            "improvement"
                        );
                    }
                ),

                thanks: projectItems.filter(
                    function (item) {
                        return (
                            item.bucketType ===
                            "thanks"
                        );
                    }
                )
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/retrospective/add",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const bucketType = cleanText(
                req.body.bucketType
            );
            const content = cleanText(
                req.body.content
            );

            if (
                !isValidBucket(bucketType) ||
                !content
            ) {
                req.flash(
                    "error",
                    "Please enter valid retrospective information."
                );

                return res.redirect(
                    "/retrospective"
                );
            }

            await db.query(
                `
                INSERT INTO retrospective_items (
                    project_id,
                    user_id,
                    bucket_type,
                    content
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    projectId,
                    res.locals.currentUser.userId,
                    bucketType,
                    content
                ]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                " added a retrospective entry."
            );

            req.flash(
                "success",
                "Retrospective entry added."
            );

            res.redirect("/retrospective");
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/retrospective/:id/edit",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const retrospectiveId = Number(
                req.params.id
            );

            const item =
                await getRetrospectiveById(
                    retrospectiveId,
                    projectId
                );

            if (!item) {
                req.flash(
                    "error",
                    "Retrospective entry not found."
                );

                return res.redirect(
                    "/retrospective"
                );
            }

            const canManage =
                res.locals.currentProjectRole ===
                "Project Leader" ||
                item.userId ===
                res.locals.currentUser.userId;

            if (!canManage) {
                req.flash(
                    "error",
                    "You can only edit your own retrospective entries."
                );

                return res.redirect(
                    "/retrospective"
                );
            }

            const bucketType = cleanText(
                req.body.bucketType
            );
            const content = cleanText(
                req.body.content
            );

            if (
                !isValidBucket(bucketType) ||
                !content
            ) {
                req.flash(
                    "error",
                    "Please enter valid retrospective information."
                );

                return res.redirect(
                    "/retrospective"
                );
            }

            await db.query(
                `
                UPDATE retrospective_items
                SET
                    bucket_type = ?,
                    content = ?
                WHERE retrospective_id = ?
                  AND project_id = ?
                `,
                [
                    bucketType,
                    content,
                    retrospectiveId,
                    projectId
                ]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                " updated a retrospective entry."
            );

            req.flash(
                "success",
                "Retrospective entry updated."
            );

            res.redirect("/retrospective");
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    "/retrospective/:id/delete",
    requireLogin,
    requireSelectedProject,
    async function (req, res, next) {
        try {
            const projectId =
                res.locals.selectedProject.projectId;
            const retrospectiveId = Number(
                req.params.id
            );

            const item =
                await getRetrospectiveById(
                    retrospectiveId,
                    projectId
                );

            if (!item) {
                req.flash(
                    "error",
                    "Retrospective entry not found."
                );

                return res.redirect(
                    "/retrospective"
                );
            }

            const canManage =
                res.locals.currentProjectRole ===
                "Project Leader" ||
                item.userId ===
                res.locals.currentUser.userId;

            if (!canManage) {
                req.flash(
                    "error",
                    "You can only delete your own retrospective entries."
                );

                return res.redirect(
                    "/retrospective"
                );
            }

            await db.query(
                `
                DELETE FROM retrospective_items
                WHERE retrospective_id = ?
                  AND project_id = ?
                `,
                [retrospectiveId, projectId]
            );

            await addActivity(
                projectId,
                res.locals.currentUser.userId,
                res.locals.currentUser.name +
                " deleted a retrospective entry."
            );

            req.flash(
                "success",
                "Retrospective entry deleted."
            );

            res.redirect("/retrospective");
        } catch (error) {
            next(error);
        }
    }
);


// ======================================================
// MULTER AND GENERAL ERROR HANDLING
// ======================================================

app.use(function (error, req, res, next) {
    console.error(error);

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            req.flash(
                "error",
                "The profile picture must not exceed 5 MB."
            );
        } else {
            req.flash(
                "error",
                "The profile picture could not be uploaded."
            );
        }

        return res.redirect("/profile/edit");
    }

    if (
        error.message ===
        "Only JPG, PNG and WEBP images are allowed."
    ) {
        req.flash("error", error.message);
        return res.redirect("/profile/edit");
    }

    if (error.code === "ER_NO_SUCH_TABLE") {
        return res.status(500).send(
            "A required database table is missing. Run database_setup.sql first."
        );
    }

    if (error.code === "ER_DUP_ENTRY") {
        req.flash(
            "error",
            "That value already exists in the database."
        );

        return res.redirect(req.get("referer") || "/");
    }

    res.status(500).send(
        "An unexpected server error occurred. Check the terminal for details."
    );
});


// ======================================================
// PAGE NOT FOUND
// ======================================================

app.use(function (req, res) {
    res.status(404).send("Page not found.");
});


// ======================================================
// SERVER STARTUP
// ======================================================

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});