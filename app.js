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
    database: "c237_010_team_2_testdb",
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect(function (error) {
    if (error) {
        console.error(
            "Database connection failed:",
            error.message
        );
        return;
    }

    console.log(
        "Connected to MySQL database successfully"
    );
});

// =====================================================
// EXPRESS SETTINGS
// =====================================================

app.set("view engine", "ejs");

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(express.json());
app.use(express.static("resources/public"));

app.use(
    session({
        secret: "student-project-management-secret",
        resave: false,
        saveUninitialized: false,

        cookie: {
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7
        }
    })
);

app.use(flash());

app.use(function (req, res, next) {
    res.locals.successMessages =
        req.flash("success");

    res.locals.errorMessages =
        req.flash("error");

    next();
});

// =====================================================
// MULTER CONFIGURATION
// =====================================================

const allowedImageTypes = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

const profileStorage =
    multer.diskStorage({
        destination: function (
            req,
            file,
            callback
        ) {
            callback(
                null,
                "resources/public/images/profile-pictures"
            );
        },

        filename: function (
            req,
            file,
            callback
        ) {
            const extension =
                allowedImageTypes[
                file.mimetype
                ];

            const filename =
                "profile-" +
                Date.now() +
                "-" +
                Math.round(
                    Math.random() *
                    1000000000
                ) +
                extension;

            callback(
                null,
                filename
            );
        }
    });

const uploadProfilePicture =
    multer({
        storage: profileStorage,

        fileFilter: function (
            req,
            file,
            callback
        ) {
            if (
                allowedImageTypes[
                file.mimetype
                ]
            ) {
                callback(
                    null,
                    true
                );
            } else {
                callback(
                    new Error(
                        "Only JPG, PNG and WEBP images are allowed."
                    )
                );
            }
        },

        limits: {
            fileSize:
                5 *
                1024 *
                1024
        }
    });

// =====================================================
// OPTIONS AND VALIDATION
// =====================================================

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

function cleanText(value) {
    return String(
        value || ""
    ).trim();
}

function isValidPriority(
    priority
) {
    return [
        "Low",
        "Medium",
        "High"
    ].includes(priority);
}

function isValidTaskStatus(
    status
) {
    return [
        "Not Started",
        "In Progress",
        "Completed"
    ].includes(status);
}

function isValidBucket(
    bucketType
) {
    return [
        "went_well",
        "improvement",
        "thanks"
    ].includes(bucketType);
}

// =====================================================
// DATABASE HELPERS
// =====================================================

function getUserById(
    userId,
    callback
) {
    const sql = `
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
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(
        sql,
        [userId],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results[0] ||
                null
            );
        }
    );
}

function getUserByEmail(
    email,
    callback
) {
    const sql = `
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
    `;

    db.query(
        sql,
        [email],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results[0] ||
                null
            );
        }
    );
}

function getProjectContext(
    projectId,
    userId,
    callback
) {
    const sql = `
        SELECT
            p.project_id AS projectId,
            p.project_name AS projectName,
            p.description,
            pm.role
        FROM projects p

        INNER JOIN project_members pm
            ON p.project_id =
               pm.project_id

        WHERE p.project_id = ?
          AND pm.user_id = ?

        LIMIT 1
    `;

    db.query(
        sql,
        [
            projectId,
            userId
        ],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results[0] ||
                null
            );
        }
    );
}

function getProjectMembers(
    projectId,
    callback
) {
    const sql = `
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
            ON pm.user_id =
               u.user_id

        WHERE pm.project_id = ?

        ORDER BY
            CASE
                WHEN pm.role =
                     'Project Leader'
                THEN 0
                ELSE 1
            END,
            u.name
    `;

    db.query(
        sql,
        [projectId],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results
            );
        }
    );
}

function getTaskById(
    taskId,
    projectId,
    callback
) {
    const sql = `
        SELECT
            t.task_id AS taskId,
            t.project_id AS projectId,
            t.task_name AS taskName,
            t.description,
            t.assigned_user_id AS assignedUserId,
            t.created_by_user_id AS createdByUserId,
            t.priority,
            t.status,

            DATE_FORMAT(
                t.due_date,
                '%Y-%m-%d'
            ) AS dueDate,

            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            u.name AS assignedUserName

        FROM tasks t

        LEFT JOIN users u
            ON t.assigned_user_id =
               u.user_id

        WHERE t.task_id = ?
          AND t.project_id = ?

        LIMIT 1
    `;

    db.query(
        sql,
        [
            taskId,
            projectId
        ],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results[0] ||
                null
            );
        }
    );
}

function getMeetingById(
    meetingId,
    projectId,
    callback
) {
    const sql = `
        SELECT
            meeting_id AS meetingId,
            project_id AS projectId,
            meeting_title AS meetingTitle,

            DATE_FORMAT(
                meeting_date,
                '%Y-%m-%d'
            ) AS meetingDate,

            TIME_FORMAT(
                meeting_time,
                '%H:%i'
            ) AS meetingTime,

            location,
            agenda,
            created_by_user_id AS createdByUserId

        FROM meetings

        WHERE meeting_id = ?
          AND project_id = ?

        LIMIT 1
    `;

    db.query(
        sql,
        [
            meetingId,
            projectId
        ],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results[0] ||
                null
            );
        }
    );
}

function getRetrospectiveById(
    retrospectiveId,
    projectId,
    callback
) {
    const sql = `
        SELECT
            retrospective_id AS retrospectiveId,
            project_id AS projectId,
            user_id AS userId,
            bucket_type AS bucketType,
            content

        FROM retrospective_items

        WHERE retrospective_id = ?
          AND project_id = ?

        LIMIT 1
    `;

    db.query(
        sql,
        [
            retrospectiveId,
            projectId
        ],
        function (
            error,
            results
        ) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(
                null,
                results[0] ||
                null
            );
        }
    );
}

function addActivity(
    projectId,
    userId,
    description,
    callback
) {
    const sql = `
        INSERT INTO activities (
            project_id,
            user_id,
            description
        )
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [
            projectId,
            userId,
            description
        ],
        function (error) {
            if (error) {
                return callback(
                    error
                );
            }

            callback(null);
        }
    );
}

// =====================================================
// LOAD CURRENT USER AND PROJECT
// =====================================================

app.use(function (
    req,
    res,
    next
) {
    res.locals.currentUser =
        null;

    res.locals.selectedProject =
        null;

    res.locals.currentProjectRole =
        null;

    res.locals.diplomaOptions =
        diplomaOptions;

    res.locals.yearSemesterOptions =
        yearSemesterOptions;

    if (
        !req.session.userId
    ) {
        return next();
    }

    getUserById(
        req.session.userId,

        function (
            userError,
            currentUser
        ) {
            if (userError) {
                return next(
                    userError
                );
            }

            if (!currentUser) {
                req.session.userId =
                    null;

                req.session
                    .selectedProjectId =
                    null;

                return next();
            }

            res.locals.currentUser =
                currentUser;

            if (
                !req.session
                    .selectedProjectId
            ) {
                return next();
            }

            getProjectContext(
                req.session
                    .selectedProjectId,

                currentUser.userId,

                function (
                    projectError,
                    projectContext
                ) {
                    if (
                        projectError
                    ) {
                        return next(
                            projectError
                        );
                    }

                    if (
                        !projectContext
                    ) {
                        req.session
                            .selectedProjectId =
                            null;

                        return next();
                    }

                    res.locals.selectedProject =
                    {
                        projectId:
                            projectContext
                                .projectId,

                        projectName:
                            projectContext
                                .projectName,

                        description:
                            projectContext
                                .description
                    };

                    res.locals
                        .currentProjectRole =
                        projectContext
                            .role;

                    next();
                }
            );
        }
    );
});

// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

function requireLogin(
    req,
    res,
    next
) {
    if (
        !res.locals.currentUser
    ) {
        req.flash(
            "error",
            "Please log in before accessing that page."
        );

        return res.redirect(
            "/login"
        );
    }

    next();
}

function requireSelectedProject(
    req,
    res,
    next
) {
    if (
        !res.locals
            .selectedProject
    ) {
        req.flash(
            "error",
            "Please select a project first."
        );

        return res.redirect(
            "/projects"
        );
    }

    next();
}

function requireProjectLeader(
    req,
    res,
    next
) {
    if (
        res.locals
            .currentProjectRole !==
        "Project Leader"
    ) {
        req.flash(
            "error",
            "Only the Project Leader can perform that action."
        );

        return res.redirect(
            "/dashboard"
        );
    }

    next();
}

// =====================================================
// HOME, LOGIN AND LOGOUT
// =====================================================

app.get(
    "/",
    function (req, res) {
        if (
            !res.locals
                .currentUser
        ) {
            return res.redirect(
                "/login"
            );
        }

        if (
            !res.locals
                .selectedProject
        ) {
            return res.redirect(
                "/projects"
            );
        }

        res.redirect(
            "/dashboard"
        );
    }
);

app.get(
    "/login",
    function (req, res) {
        if (
            res.locals.currentUser
        ) {
            return res.redirect(
                "/projects"
            );
        }

        res.render("login");
    }
);

app.post(
    "/login",
    function (
        req,
        res,
        next
    ) {
        const username =
            cleanText(
                req.body.username
            );

        const password =
            String(
                req.body.password ||
                ""
            );

        const sql = `
            SELECT
                user_id AS userId,
                username,
                password,
                name

            FROM users

            WHERE LOWER(username) =
                  LOWER(?)
              AND password = ?

            LIMIT 1
        `;

        db.query(
            sql,
            [
                username,
                password
            ],
            function (
                error,
                results
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                const user =
                    results[0];

                if (!user) {
                    req.flash(
                        "error",
                        "The username or password is incorrect."
                    );

                    return res.redirect(
                        "/login"
                    );
                }

                req.session.userId =
                    user.userId;

                req.session
                    .selectedProjectId =
                    null;

                req.flash(
                    "success",
                    "Welcome, " +
                    user.name +
                    "."
                );

                res.redirect(
                    "/projects"
                );
            }
        );
    }
);

app.get(
    "/logout",
    function (req, res) {
        req.session.userId =
            null;

        req.session
            .selectedProjectId =
            null;

        req.flash(
            "success",
            "You have been logged out."
        );

        res.redirect("/login");
    }
);

// =====================================================
// PROJECT SELECTION
// =====================================================

app.get(
    "/projects",
    requireLogin,

    function (
        req,
        res,
        next
    ) {
        const sql = `
            SELECT
                p.project_id AS projectId,
                p.project_name AS projectName,
                p.description,
                pm.role

            FROM project_members pm

            INNER JOIN projects p
                ON pm.project_id =
                   p.project_id

            WHERE pm.user_id = ?

            ORDER BY
                p.project_name
        `;

        db.query(
            sql,

            [
                res.locals
                    .currentUser
                    .userId
            ],

            function (
                error,
                userProjects
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                res.render(
                    "projectselection",
                    {
                        userProjects:
                            userProjects
                    }
                );
            }
        );
    }
);

app.post(
    "/projects/select",
    requireLogin,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            Number(
                req.body.projectId
            );

        getProjectContext(
            projectId,

            res.locals
                .currentUser.userId,

            function (
                error,
                projectContext
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                if (
                    !projectContext
                ) {
                    req.flash(
                        "error",
                        "You are not a member of that project."
                    );

                    return res.redirect(
                        "/projects"
                    );
                }

                req.session
                    .selectedProjectId =
                    projectId;

                req.flash(
                    "success",
                    "Project selected successfully."
                );

                res.redirect(
                    "/dashboard"
                );
            }
        );
    }
);

// =====================================================
// DASHBOARD
// =====================================================

app.get(
    "/dashboard",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const summarySql = `
            SELECT
                COUNT(*) AS totalTasks,

                SUM(
                    status =
                    'Completed'
                ) AS completedTasks,

                SUM(
                    status =
                    'In Progress'
                ) AS inProgressTasks

            FROM tasks

            WHERE project_id = ?
        `;

        db.query(
            summarySql,
            [projectId],

            function (
                summaryError,
                summaryRows
            ) {
                if (
                    summaryError
                ) {
                    return next(
                        summaryError
                    );
                }

                const summary =
                    summaryRows[0];

                const totalTasks =
                    Number(
                        summary
                            .totalTasks ||
                        0
                    );

                const completedTasks =
                    Number(
                        summary
                            .completedTasks ||
                        0
                    );

                const inProgressTasks =
                    Number(
                        summary
                            .inProgressTasks ||
                        0
                    );

                let completionPercentage =
                    0;

                let teamProductivity =
                    0;

                if (
                    totalTasks > 0
                ) {
                    completionPercentage =
                        Math.round(
                            (
                                completedTasks /
                                totalTasks
                            ) *
                            100
                        );

                    teamProductivity =
                        Math.round(
                            (
                                completedTasks +
                                inProgressTasks *
                                0.5
                            ) /
                            totalTasks *
                            100
                        );
                }

                const deadlinesSql = `
                    SELECT
                        task_id AS taskId,
                        task_name AS taskName,
                        status,

                        DATE_FORMAT(
                            due_date,
                            '%Y-%m-%d'
                        ) AS dueDate

                    FROM tasks

                    WHERE project_id = ?
                      AND status <>
                          'Completed'
                      AND due_date >=
                          CURDATE()

                    ORDER BY
                        due_date ASC

                    LIMIT 5
                `;

                db.query(
                    deadlinesSql,
                    [projectId],

                    function (
                        deadlineError,
                        upcomingDeadlines
                    ) {
                        if (
                            deadlineError
                        ) {
                            return next(
                                deadlineError
                            );
                        }

                        const activitySql = `
                            SELECT
                                activity_id AS activityId,
                                description,
                                created_at AS createdAt

                            FROM activities

                            WHERE project_id = ?

                            ORDER BY
                                created_at DESC

                            LIMIT 5
                        `;

                        db.query(
                            activitySql,
                            [projectId],

                            function (
                                activityError,
                                recentActivities
                            ) {
                                if (
                                    activityError
                                ) {
                                    return next(
                                        activityError
                                    );
                                }

                                const meetingSql = `
                                    SELECT
                                        meeting_id AS meetingId,
                                        meeting_title AS meetingTitle,

                                        DATE_FORMAT(
                                            meeting_date,
                                            '%Y-%m-%d'
                                        ) AS meetingDate,

                                        TIME_FORMAT(
                                            meeting_time,
                                            '%H:%i'
                                        ) AS meetingTime,

                                        location,
                                        agenda

                                    FROM meetings

                                    WHERE project_id = ?
                                      AND YEARWEEK(
                                          meeting_date,
                                          1
                                      ) =
                                      YEARWEEK(
                                          CURDATE(),
                                          1
                                      )

                                    ORDER BY
                                        meeting_date,
                                        meeting_time
                                `;

                                db.query(
                                    meetingSql,
                                    [projectId],

                                    function (
                                        meetingError,
                                        meetingsThisWeek
                                    ) {
                                        if (
                                            meetingError
                                        ) {
                                            return next(
                                                meetingError
                                            );
                                        }

                                        res.render(
                                            "dashboard",
                                            {
                                                user:
                                                    res.locals
                                                        .currentUser,

                                                selectedProject:
                                                    res.locals
                                                        .selectedProject,

                                                currentProjectRole:
                                                    res.locals
                                                        .currentProjectRole,

                                                dashboard:
                                                {
                                                    completionPercentage:
                                                        completionPercentage,

                                                    teamProductivity:
                                                        teamProductivity,

                                                    totalTasks:
                                                        totalTasks
                                                },

                                                upcomingDeadlines:
                                                    upcomingDeadlines,

                                                recentActivities:
                                                    recentActivities,

                                                meetingsThisWeek:
                                                    meetingsThisWeek
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// =====================================================
// PROFILE
// =====================================================

app.get(
    "/profile",
    requireLogin,

    function (req, res) {
        res.render(
            "profile",
            {
                user:
                    res.locals
                        .currentUser
            }
        );
    }
);

app.get(
    "/profile/edit",
    requireLogin,

    function (req, res) {
        res.render(
            "editprofile",
            {
                user:
                    res.locals
                        .currentUser,

                diplomaOptions:
                    diplomaOptions,

                yearSemesterOptions:
                    yearSemesterOptions
            }
        );
    }
);

app.post(
    "/profile/edit",
    requireLogin,

    uploadProfilePicture.single(
        "profilePicture"
    ),

    function (
        req,
        res,
        next
    ) {
        const currentUser =
            res.locals.currentUser;

        const name =
            cleanText(
                req.body.name
            );

        const email =
            cleanText(
                req.body.email
            ).toLowerCase();

        if (
            !name ||
            !email
        ) {
            req.flash(
                "error",
                "Name and email are required."
            );

            return res.redirect(
                "/profile/edit"
            );
        }

        getUserByEmail(
            email,

            function (
                emailError,
                existingUser
            ) {
                if (
                    emailError
                ) {
                    return next(
                        emailError
                    );
                }

                if (
                    existingUser &&
                    existingUser.userId !==
                    currentUser.userId
                ) {
                    req.flash(
                        "error",
                        "That email is already used by another user."
                    );

                    return res.redirect(
                        "/profile/edit"
                    );
                }

                let profilePicture =
                    currentUser
                        .profilePicture;

                if (req.file) {
                    profilePicture =
                        "/images/profile-pictures/" +
                        req.file.filename;
                }

                const sql = `
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
                `;

                const values = [
                    name,
                    email,

                    cleanText(
                        req.body
                            .contactNumber
                    ),

                    cleanText(
                        req.body.diploma
                    ),

                    cleanText(
                        req.body
                            .yearSemester
                    ),

                    cleanText(
                        req.body.bio
                    ),

                    profilePicture,
                    currentUser.userId
                ];

                db.query(
                    sql,
                    values,

                    function (
                        updateError
                    ) {
                        if (
                            updateError
                        ) {
                            return next(
                                updateError
                            );
                        }

                        req.flash(
                            "success",
                            "Your profile has been updated."
                        );

                        res.redirect(
                            "/profile"
                        );
                    }
                );
            }
        );
    }
);

app.get(
    "/profile/change-password",
    requireLogin,

    function (req, res) {
        res.render(
            "changepassword",
            {
                user:
                    res.locals
                        .currentUser
            }
        );
    }
);

app.post(
    "/profile/change-password",
    requireLogin,

    function (
        req,
        res,
        next
    ) {
        const currentUser =
            res.locals.currentUser;

        const currentPassword =
            String(
                req.body
                    .currentPassword ||
                ""
            );

        const newPassword =
            String(
                req.body
                    .newPassword ||
                ""
            );

        const confirmPassword =
            String(
                req.body
                    .confirmPassword ||
                ""
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

        if (
            newPassword.length <
            8
        ) {
            req.flash(
                "error",
                "The new password must contain at least eight characters."
            );

            return res.redirect(
                "/profile/change-password"
            );
        }

        if (
            newPassword !==
            confirmPassword
        ) {
            req.flash(
                "error",
                "The new passwords do not match."
            );

            return res.redirect(
                "/profile/change-password"
            );
        }

        if (
            newPassword ===
            currentPassword
        ) {
            req.flash(
                "error",
                "The new password must be different from the current password."
            );

            return res.redirect(
                "/profile/change-password"
            );
        }

        db.query(
            `
            UPDATE users
            SET password = ?
            WHERE user_id = ?
            `,

            [
                newPassword,
                currentUser.userId
            ],

            function (error) {
                if (error) {
                    return next(
                        error
                    );
                }

                req.flash(
                    "success",
                    "Your password has been changed."
                );

                res.redirect(
                    "/profile"
                );
            }
        );
    }
);

// =====================================================
// PROJECT MEMBERS
// =====================================================

app.get(
    "/project-members",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        getProjectMembers(
            projectId,

            function (
                error,
                members
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                res.render(
                    "userlist",
                    {
                        members:
                            members,

                        diplomaOptions:
                            diplomaOptions,

                        yearSemesterOptions:
                            yearSemesterOptions
                    }
                );
            }
        );
    }
);

app.post(
    "/project-members/add",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const name =
            cleanText(
                req.body.name
            );

        const email =
            cleanText(
                req.body.email
            ).toLowerCase();

        const diploma =
            cleanText(
                req.body.diploma
            );

        const yearSemester =
            cleanText(
                req.body
                    .yearSemester
            );

        const bio =
            cleanText(
                req.body.bio
            );

        if (
            !name ||
            !email
        ) {
            req.flash(
                "error",
                "Name and email are required."
            );

            return res.redirect(
                "/project-members"
            );
        }

        getUserByEmail(
            email,

            function (
                findError,
                existingUser
            ) {
                if (
                    findError
                ) {
                    return next(
                        findError
                    );
                }

                if (
                    existingUser
                ) {
                    addExistingUserToProject(
                        existingUser
                    );
                } else {
                    createNewUser();
                }
            }
        );

        function addExistingUserToProject(
            user
        ) {
            const checkSql = `
                SELECT project_id

                FROM project_members

                WHERE project_id = ?
                  AND user_id = ?

                LIMIT 1
            `;

            db.query(
                checkSql,

                [
                    projectId,
                    user.userId
                ],

                function (
                    error,
                    rows
                ) {
                    if (error) {
                        return next(
                            error
                        );
                    }

                    if (
                        rows.length > 0
                    ) {
                        req.flash(
                            "error",
                            "That user is already a member of this project."
                        );

                        return res.redirect(
                            "/project-members"
                        );
                    }

                    insertMembership(
                        user.userId,
                        user.name
                    );
                }
            );
        }

        function createNewUser() {
            const usernameBase =
                email.split(
                    "@"
                )[0] ||
                "student";

            const username =
                usernameBase +
                Date.now();

            const sql = `
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
            `;

            const values = [
                username,
                "Temp1234",
                name,
                email,
                diploma,
                yearSemester,
                bio,

                "/images/profile-pictures/default-profile.svg"
            ];

            db.query(
                sql,
                values,

                function (
                    error,
                    result
                ) {
                    if (error) {
                        return next(
                            error
                        );
                    }

                    insertMembership(
                        result.insertId,
                        name
                    );
                }
            );
        }

        function insertMembership(
            userId,
            memberName
        ) {
            const sql = `
                INSERT INTO project_members (
                    project_id,
                    user_id,
                    role
                )
                VALUES (
                    ?,
                    ?,
                    'Project Member'
                )
            `;

            db.query(
                sql,

                [
                    projectId,
                    userId
                ],

                function (error) {
                    if (error) {
                        return next(
                            error
                        );
                    }

                    addActivity(
                        projectId,

                        res.locals
                            .currentUser
                            .userId,

                        res.locals
                            .currentUser
                            .name +
                        " added " +
                        memberName +
                        " to the project.",

                        function (
                            activityError
                        ) {
                            if (
                                activityError
                            ) {
                                return next(
                                    activityError
                                );
                            }

                            req.flash(
                                "success",
                                "Project member added successfully."
                            );

                            res.redirect(
                                "/project-members"
                            );
                        }
                    );
                }
            );
        }
    }
);

app.post(
    "/project-members/:userId/make-leader",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const targetUserId =
            Number(
                req.params.userId
            );

        const targetSql = `
            SELECT
                pm.role,
                u.name

            FROM project_members pm

            INNER JOIN users u
                ON pm.user_id =
                   u.user_id

            WHERE pm.project_id = ?
              AND pm.user_id = ?

            LIMIT 1
        `;

        db.query(
            targetSql,

            [
                projectId,
                targetUserId
            ],

            function (
                targetError,
                targetRows
            ) {
                if (
                    targetError
                ) {
                    return next(
                        targetError
                    );
                }

                if (
                    targetRows.length ===
                    0
                ) {
                    req.flash(
                        "error",
                        "That user is not a member of this project."
                    );

                    return res.redirect(
                        "/project-members"
                    );
                }

                if (
                    targetRows[0]
                        .role ===
                    "Project Leader"
                ) {
                    req.flash(
                        "error",
                        "That user is already the Project Leader."
                    );

                    return res.redirect(
                        "/project-members"
                    );
                }

                db.beginTransaction(
                    function (
                        transactionError
                    ) {
                        if (
                            transactionError
                        ) {
                            return next(
                                transactionError
                            );
                        }

                        const demoteSql = `
                            UPDATE project_members

                            SET role =
                                'Project Member'

                            WHERE project_id = ?
                              AND role =
                                  'Project Leader'
                        `;

                        db.query(
                            demoteSql,
                            [projectId],

                            function (
                                demoteError
                            ) {
                                if (
                                    demoteError
                                ) {
                                    return db.rollback(
                                        function () {
                                            next(
                                                demoteError
                                            );
                                        }
                                    );
                                }

                                const promoteSql = `
                                    UPDATE project_members

                                    SET role =
                                        'Project Leader'

                                    WHERE project_id = ?
                                      AND user_id = ?
                                `;

                                db.query(
                                    promoteSql,

                                    [
                                        projectId,
                                        targetUserId
                                    ],

                                    function (
                                        promoteError
                                    ) {
                                        if (
                                            promoteError
                                        ) {
                                            return db.rollback(
                                                function () {
                                                    next(
                                                        promoteError
                                                    );
                                                }
                                            );
                                        }

                                        addActivity(
                                            projectId,

                                            res.locals
                                                .currentUser
                                                .userId,

                                            targetRows[0]
                                                .name +
                                            " became the Project Leader.",

                                            function (
                                                activityError
                                            ) {
                                                if (
                                                    activityError
                                                ) {
                                                    return db.rollback(
                                                        function () {
                                                            next(
                                                                activityError
                                                            );
                                                        }
                                                    );
                                                }

                                                db.commit(
                                                    function (
                                                        commitError
                                                    ) {
                                                        if (
                                                            commitError
                                                        ) {
                                                            return db.rollback(
                                                                function () {
                                                                    next(
                                                                        commitError
                                                                    );
                                                                }
                                                            );
                                                        }

                                                        req.flash(
                                                            "success",
                                                            "Project Leader role transferred successfully."
                                                        );

                                                        res.redirect(
                                                            "/dashboard"
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

app.post(
    "/project-members/:userId/remove",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const targetUserId =
            Number(
                req.params.userId
            );

        const targetSql = `
            SELECT
                pm.role,
                u.name

            FROM project_members pm

            INNER JOIN users u
                ON pm.user_id =
                   u.user_id

            WHERE pm.project_id = ?
              AND pm.user_id = ?

            LIMIT 1
        `;

        db.query(
            targetSql,

            [
                projectId,
                targetUserId
            ],

            function (
                targetError,
                targetRows
            ) {
                if (
                    targetError
                ) {
                    return next(
                        targetError
                    );
                }

                if (
                    targetRows.length ===
                    0
                ) {
                    req.flash(
                        "error",
                        "That user is not a member of this project."
                    );

                    return res.redirect(
                        "/project-members"
                    );
                }

                if (
                    targetRows[0]
                        .role ===
                    "Project Leader"
                ) {
                    req.flash(
                        "error",
                        "Transfer the Project Leader role before removing this member."
                    );

                    return res.redirect(
                        "/project-members"
                    );
                }

                db.beginTransaction(
                    function (
                        transactionError
                    ) {
                        if (
                            transactionError
                        ) {
                            return next(
                                transactionError
                            );
                        }

                        const unassignSql = `
                            UPDATE tasks

                            SET assigned_user_id =
                                NULL

                            WHERE project_id = ?
                              AND assigned_user_id = ?
                        `;

                        db.query(
                            unassignSql,

                            [
                                projectId,
                                targetUserId
                            ],

                            function (
                                unassignError
                            ) {
                                if (
                                    unassignError
                                ) {
                                    return db.rollback(
                                        function () {
                                            next(
                                                unassignError
                                            );
                                        }
                                    );
                                }

                                const deleteSql = `
                                    DELETE FROM project_members

                                    WHERE project_id = ?
                                      AND user_id = ?
                                `;

                                db.query(
                                    deleteSql,

                                    [
                                        projectId,
                                        targetUserId
                                    ],

                                    function (
                                        deleteError
                                    ) {
                                        if (
                                            deleteError
                                        ) {
                                            return db.rollback(
                                                function () {
                                                    next(
                                                        deleteError
                                                    );
                                                }
                                            );
                                        }

                                        addActivity(
                                            projectId,

                                            res.locals
                                                .currentUser
                                                .userId,

                                            targetRows[0]
                                                .name +
                                            " was removed from the project.",

                                            function (
                                                activityError
                                            ) {
                                                if (
                                                    activityError
                                                ) {
                                                    return db.rollback(
                                                        function () {
                                                            next(
                                                                activityError
                                                            );
                                                        }
                                                    );
                                                }

                                                db.commit(
                                                    function (
                                                        commitError
                                                    ) {
                                                        if (
                                                            commitError
                                                        ) {
                                                            return db.rollback(
                                                                function () {
                                                                    next(
                                                                        commitError
                                                                    );
                                                                }
                                                            );
                                                        }

                                                        req.flash(
                                                            "success",
                                                            "The member was removed from this project only."
                                                        );

                                                        res.redirect(
                                                            "/project-members"
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// =====================================================
// TASKS
// =====================================================

app.get(
    "/tasks",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const sql = `
            SELECT
                t.task_id AS taskId,
                t.task_name AS taskName,
                t.description,
                t.priority,
                t.status,

                DATE_FORMAT(
                    t.due_date,
                    '%Y-%m-%d'
                ) AS dueDate,

                COALESCE(
                    u.name,
                    'Unassigned'
                ) AS assignedUserName

            FROM tasks t

            LEFT JOIN users u
                ON t.assigned_user_id =
                   u.user_id

            WHERE t.project_id = ?

            ORDER BY
                t.due_date,
                t.task_name
        `;

        db.query(
            sql,
            [projectId],

            function (
                error,
                projectTasks
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                res.render(
                    "tasklist",
                    {
                        tasks:
                            projectTasks
                    }
                );
            }
        );
    }
);

app.get(
    "/addtask",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        getProjectMembers(
            res.locals
                .selectedProject
                .projectId,

            function (
                error,
                members
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                res.render(
                    "addtask",
                    {
                        members:
                            members
                    }
                );
            }
        );
    }
);

app.post(
    "/addtask",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const taskName =
            cleanText(
                req.body.taskName
            );

        const description =
            cleanText(
                req.body.description
            );

        const assignedUserId =
            Number(
                req.body
                    .assignedUserId
            );

        const priority =
            cleanText(
                req.body.priority
            );

        const status =
            cleanText(
                req.body.status
            );

        const dueDate =
            cleanText(
                req.body.dueDate
            );

        const membershipSql = `
            SELECT user_id

            FROM project_members

            WHERE project_id = ?
              AND user_id = ?

            LIMIT 1
        `;

        db.query(
            membershipSql,

            [
                projectId,
                assignedUserId
            ],

            function (
                membershipError,
                membershipRows
            ) {
                if (
                    membershipError
                ) {
                    return next(
                        membershipError
                    );
                }

                if (
                    !taskName ||
                    !dueDate ||
                    membershipRows
                        .length === 0
                ) {
                    req.flash(
                        "error",
                        "Task name, due date and a valid project member are required."
                    );

                    return res.redirect(
                        "/addtask"
                    );
                }

                if (
                    !isValidPriority(
                        priority
                    ) ||
                    !isValidTaskStatus(
                        status
                    )
                ) {
                    req.flash(
                        "error",
                        "Please select a valid priority and status."
                    );

                    return res.redirect(
                        "/addtask"
                    );
                }

                const insertSql = `
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
                `;

                const values = [
                    projectId,
                    taskName,
                    description,
                    assignedUserId,

                    res.locals
                        .currentUser
                        .userId,

                    priority,
                    status,
                    dueDate
                ];

                db.query(
                    insertSql,
                    values,

                    function (
                        insertError
                    ) {
                        if (
                            insertError
                        ) {
                            return next(
                                insertError
                            );
                        }

                        addActivity(
                            projectId,

                            res.locals
                                .currentUser
                                .userId,

                            res.locals
                                .currentUser
                                .name +
                            ' added the task "' +
                            taskName +
                            '".',

                            function (
                                activityError
                            ) {
                                if (
                                    activityError
                                ) {
                                    return next(
                                        activityError
                                    );
                                }

                                req.flash(
                                    "success",
                                    "Task added successfully."
                                );

                                res.redirect(
                                    "/tasks"
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

app.get(
    "/tasks/:id",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        getTaskById(
            req.params.id,

            res.locals
                .selectedProject
                .projectId,

            function (
                error,
                task
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                if (!task) {
                    req.flash(
                        "error",
                        "Task not found in the selected project."
                    );

                    return res.redirect(
                        "/tasks"
                    );
                }

                let assignedUser =
                    null;

                if (
                    task.assignedUserId
                ) {
                    assignedUser = {
                        userId:
                            task
                                .assignedUserId,

                        name:
                            task
                                .assignedUserName
                    };
                }

                res.render(
                    "taskdetails",
                    {
                        task:
                            task,

                        assignedUser:
                            assignedUser
                    }
                );
            }
        );
    }
);

app.get(
    "/tasks/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        getTaskById(
            req.params.id,
            projectId,

            function (
                taskError,
                task
            ) {
                if (
                    taskError
                ) {
                    return next(
                        taskError
                    );
                }

                if (!task) {
                    req.flash(
                        "error",
                        "Task not found in the selected project."
                    );

                    return res.redirect(
                        "/tasks"
                    );
                }

                getProjectMembers(
                    projectId,

                    function (
                        memberError,
                        members
                    ) {
                        if (
                            memberError
                        ) {
                            return next(
                                memberError
                            );
                        }

                        res.render(
                            "edittask",
                            {
                                task:
                                    task,

                                members:
                                    members
                            }
                        );
                    }
                );
            }
        );
    }
);

app.post(
    "/tasks/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const taskId =
            Number(
                req.params.id
            );

        const taskName =
            cleanText(
                req.body.taskName
            );

        const assignedUserId =
            Number(
                req.body
                    .assignedUserId
            );

        const priority =
            cleanText(
                req.body.priority
            );

        const status =
            cleanText(
                req.body.status
            );

        const dueDate =
            cleanText(
                req.body.dueDate
            );

        getTaskById(
            taskId,
            projectId,

            function (
                taskError,
                task
            ) {
                if (
                    taskError
                ) {
                    return next(
                        taskError
                    );
                }

                if (!task) {
                    req.flash(
                        "error",
                        "Task not found in the selected project."
                    );

                    return res.redirect(
                        "/tasks"
                    );
                }

                const membershipSql = `
                    SELECT user_id

                    FROM project_members

                    WHERE project_id = ?
                      AND user_id = ?

                    LIMIT 1
                `;

                db.query(
                    membershipSql,

                    [
                        projectId,
                        assignedUserId
                    ],

                    function (
                        membershipError,
                        membershipRows
                    ) {
                        if (
                            membershipError
                        ) {
                            return next(
                                membershipError
                            );
                        }

                        if (
                            !taskName ||
                            !dueDate ||
                            membershipRows
                                .length ===
                            0
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
                            !isValidPriority(
                                priority
                            ) ||
                            !isValidTaskStatus(
                                status
                            )
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

                        const updateSql = `
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
                        `;

                        const values = [
                            taskName,

                            cleanText(
                                req.body
                                    .description
                            ),

                            assignedUserId,
                            priority,
                            status,
                            dueDate,
                            taskId,
                            projectId
                        ];

                        db.query(
                            updateSql,
                            values,

                            function (
                                updateError
                            ) {
                                if (
                                    updateError
                                ) {
                                    return next(
                                        updateError
                                    );
                                }

                                addActivity(
                                    projectId,

                                    res.locals
                                        .currentUser
                                        .userId,

                                    res.locals
                                        .currentUser
                                        .name +
                                    ' updated the task "' +
                                    taskName +
                                    '".',

                                    function (
                                        activityError
                                    ) {
                                        if (
                                            activityError
                                        ) {
                                            return next(
                                                activityError
                                            );
                                        }

                                        req.flash(
                                            "success",
                                            "Task updated successfully."
                                        );

                                        res.redirect(
                                            "/tasks/" +
                                            taskId
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// =====================================================
// MEETINGS
// =====================================================

app.get(
    "/meetings",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const sql = `
            SELECT
                meeting_id AS meetingId,
                meeting_title AS meetingTitle,

                DATE_FORMAT(
                    meeting_date,
                    '%Y-%m-%d'
                ) AS meetingDate,

                TIME_FORMAT(
                    meeting_time,
                    '%H:%i'
                ) AS meetingTime,

                location,
                agenda

            FROM meetings

            WHERE project_id = ?

            ORDER BY
                meeting_date,
                meeting_time
        `;

        db.query(
            sql,
            [projectId],

            function (
                error,
                projectMeetings
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                res.render(
                    "meetings",
                    {
                        meetings:
                            projectMeetings
                    }
                );
            }
        );
    }
);

app.get(
    "/meetings/add",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (req, res) {
        res.render(
            "addmeeting"
        );
    }
);

app.post(
    "/meetings/add",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const meetingTitle =
            cleanText(
                req.body
                    .meetingTitle
            );

        const meetingDate =
            cleanText(
                req.body
                    .meetingDate
            );

        const meetingTime =
            cleanText(
                req.body
                    .meetingTime
            );

        const location =
            cleanText(
                req.body.location
            );

        const agenda =
            cleanText(
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

        const sql = `
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
        `;

        const values = [
            projectId,
            meetingTitle,
            meetingDate,
            meetingTime,
            location,
            agenda,

            res.locals
                .currentUser.userId
        ];

        db.query(
            sql,
            values,

            function (
                insertError
            ) {
                if (
                    insertError
                ) {
                    return next(
                        insertError
                    );
                }

                addActivity(
                    projectId,

                    res.locals
                        .currentUser.userId,

                    res.locals
                        .currentUser.name +
                    ' scheduled the meeting "' +
                    meetingTitle +
                    '".',

                    function (
                        activityError
                    ) {
                        if (
                            activityError
                        ) {
                            return next(
                                activityError
                            );
                        }

                        req.flash(
                            "success",
                            "Meeting scheduled successfully."
                        );

                        res.redirect(
                            "/meetings"
                        );
                    }
                );
            }
        );
    }
);

app.get(
    "/meetings/:id",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        getMeetingById(
            req.params.id,

            res.locals
                .selectedProject
                .projectId,

            function (
                error,
                meeting
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                if (!meeting) {
                    req.flash(
                        "error",
                        "Meeting not found in the selected project."
                    );

                    return res.redirect(
                        "/meetings"
                    );
                }

                res.render(
                    "meetingdetails",
                    {
                        meeting:
                            meeting
                    }
                );
            }
        );
    }
);

app.get(
    "/meetings/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        getMeetingById(
            req.params.id,

            res.locals
                .selectedProject
                .projectId,

            function (
                error,
                meeting
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                if (!meeting) {
                    req.flash(
                        "error",
                        "Meeting not found in the selected project."
                    );

                    return res.redirect(
                        "/meetings"
                    );
                }

                res.render(
                    "editmeeting",
                    {
                        meeting:
                            meeting
                    }
                );
            }
        );
    }
);

app.post(
    "/meetings/:id/edit",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const meetingId =
            Number(
                req.params.id
            );

        const meetingTitle =
            cleanText(
                req.body
                    .meetingTitle
            );

        const meetingDate =
            cleanText(
                req.body
                    .meetingDate
            );

        const meetingTime =
            cleanText(
                req.body
                    .meetingTime
            );

        getMeetingById(
            meetingId,
            projectId,

            function (
                meetingError,
                meeting
            ) {
                if (
                    meetingError
                ) {
                    return next(
                        meetingError
                    );
                }

                if (!meeting) {
                    req.flash(
                        "error",
                        "Meeting not found in the selected project."
                    );

                    return res.redirect(
                        "/meetings"
                    );
                }

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

                const sql = `
                    UPDATE meetings

                    SET
                        meeting_title = ?,
                        meeting_date = ?,
                        meeting_time = ?,
                        location = ?,
                        agenda = ?

                    WHERE meeting_id = ?
                      AND project_id = ?
                `;

                const values = [
                    meetingTitle,
                    meetingDate,
                    meetingTime,

                    cleanText(
                        req.body.location
                    ),

                    cleanText(
                        req.body.agenda
                    ),

                    meetingId,
                    projectId
                ];

                db.query(
                    sql,
                    values,

                    function (
                        updateError
                    ) {
                        if (
                            updateError
                        ) {
                            return next(
                                updateError
                            );
                        }

                        addActivity(
                            projectId,

                            res.locals
                                .currentUser
                                .userId,

                            res.locals
                                .currentUser
                                .name +
                            ' updated the meeting "' +
                            meetingTitle +
                            '".',

                            function (
                                activityError
                            ) {
                                if (
                                    activityError
                                ) {
                                    return next(
                                        activityError
                                    );
                                }

                                req.flash(
                                    "success",
                                    "Meeting updated successfully."
                                );

                                res.redirect(
                                    "/meetings/" +
                                    meetingId
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

app.post(
    "/meetings/:id/delete",
    requireLogin,
    requireSelectedProject,
    requireProjectLeader,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const meetingId =
            Number(
                req.params.id
            );

        getMeetingById(
            meetingId,
            projectId,

            function (
                meetingError,
                meeting
            ) {
                if (
                    meetingError
                ) {
                    return next(
                        meetingError
                    );
                }

                if (!meeting) {
                    req.flash(
                        "error",
                        "Meeting not found in the selected project."
                    );

                    return res.redirect(
                        "/meetings"
                    );
                }

                const sql = `
                    DELETE FROM meetings

                    WHERE meeting_id = ?
                      AND project_id = ?
                `;

                db.query(
                    sql,

                    [
                        meetingId,
                        projectId
                    ],

                    function (
                        deleteError
                    ) {
                        if (
                            deleteError
                        ) {
                            return next(
                                deleteError
                            );
                        }

                        addActivity(
                            projectId,

                            res.locals
                                .currentUser
                                .userId,

                            res.locals
                                .currentUser
                                .name +
                            ' deleted the meeting "' +
                            meeting
                                .meetingTitle +
                            '".',

                            function (
                                activityError
                            ) {
                                if (
                                    activityError
                                ) {
                                    return next(
                                        activityError
                                    );
                                }

                                req.flash(
                                    "success",
                                    "Meeting deleted successfully."
                                );

                                res.redirect(
                                    "/meetings"
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// =====================================================
// RETROSPECTIVE
// =====================================================

app.get(
    "/retrospective",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const sql = `
            SELECT
                r.retrospective_id AS retrospectiveId,
                r.user_id AS userId,
                u.name AS userName,
                r.bucket_type AS bucketType,
                r.content,
                r.created_at AS createdAt

            FROM retrospective_items r

            LEFT JOIN users u
                ON r.user_id =
                   u.user_id

            WHERE r.project_id = ?

            ORDER BY
                r.created_at DESC
        `;

        db.query(
            sql,
            [projectId],

            function (
                error,
                projectItems
            ) {
                if (error) {
                    return next(
                        error
                    );
                }

                res.render(
                    "retrospective",
                    {
                        wentWell:
                            projectItems.filter(
                                function (
                                    item
                                ) {
                                    return (
                                        item.bucketType ===
                                        "went_well"
                                    );
                                }
                            ),

                        improvements:
                            projectItems.filter(
                                function (
                                    item
                                ) {
                                    return (
                                        item.bucketType ===
                                        "improvement"
                                    );
                                }
                            ),

                        thanks:
                            projectItems.filter(
                                function (
                                    item
                                ) {
                                    return (
                                        item.bucketType ===
                                        "thanks"
                                    );
                                }
                            )
                    }
                );
            }
        );
    }
);

app.post(
    "/retrospective/add",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const bucketType =
            cleanText(
                req.body.bucketType
            );

        const content =
            cleanText(
                req.body.content
            );

        if (
            !isValidBucket(
                bucketType
            ) ||
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

        const sql = `
            INSERT INTO retrospective_items (
                project_id,
                user_id,
                bucket_type,
                content
            )
            VALUES (?, ?, ?, ?)
        `;

        db.query(
            sql,

            [
                projectId,

                res.locals
                    .currentUser
                    .userId,

                bucketType,
                content
            ],

            function (
                insertError
            ) {
                if (
                    insertError
                ) {
                    return next(
                        insertError
                    );
                }

                addActivity(
                    projectId,

                    res.locals
                        .currentUser.userId,

                    res.locals
                        .currentUser.name +
                    " added a retrospective entry.",

                    function (
                        activityError
                    ) {
                        if (
                            activityError
                        ) {
                            return next(
                                activityError
                            );
                        }

                        req.flash(
                            "success",
                            "Retrospective entry added."
                        );

                        res.redirect(
                            "/retrospective"
                        );
                    }
                );
            }
        );
    }
);

app.post(
    "/retrospective/:id/edit",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const retrospectiveId =
            Number(
                req.params.id
            );

        getRetrospectiveById(
            retrospectiveId,
            projectId,

            function (
                itemError,
                item
            ) {
                if (
                    itemError
                ) {
                    return next(
                        itemError
                    );
                }

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
                    res.locals
                        .currentProjectRole ===
                    "Project Leader" ||
                    item.userId ===
                    res.locals
                        .currentUser
                        .userId;

                if (!canManage) {
                    req.flash(
                        "error",
                        "You can only edit your own retrospective entries."
                    );

                    return res.redirect(
                        "/retrospective"
                    );
                }

                const bucketType =
                    cleanText(
                        req.body
                            .bucketType
                    );

                const content =
                    cleanText(
                        req.body.content
                    );

                if (
                    !isValidBucket(
                        bucketType
                    ) ||
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

                const sql = `
                    UPDATE retrospective_items

                    SET
                        bucket_type = ?,
                        content = ?

                    WHERE retrospective_id = ?
                      AND project_id = ?
                `;

                db.query(
                    sql,

                    [
                        bucketType,
                        content,
                        retrospectiveId,
                        projectId
                    ],

                    function (
                        updateError
                    ) {
                        if (
                            updateError
                        ) {
                            return next(
                                updateError
                            );
                        }

                        addActivity(
                            projectId,

                            res.locals
                                .currentUser
                                .userId,

                            res.locals
                                .currentUser
                                .name +
                            " updated a retrospective entry.",

                            function (
                                activityError
                            ) {
                                if (
                                    activityError
                                ) {
                                    return next(
                                        activityError
                                    );
                                }

                                req.flash(
                                    "success",
                                    "Retrospective entry updated."
                                );

                                res.redirect(
                                    "/retrospective"
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

app.post(
    "/retrospective/:id/delete",
    requireLogin,
    requireSelectedProject,

    function (
        req,
        res,
        next
    ) {
        const projectId =
            res.locals
                .selectedProject
                .projectId;

        const retrospectiveId =
            Number(
                req.params.id
            );

        getRetrospectiveById(
            retrospectiveId,
            projectId,

            function (
                itemError,
                item
            ) {
                if (
                    itemError
                ) {
                    return next(
                        itemError
                    );
                }

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
                    res.locals
                        .currentProjectRole ===
                    "Project Leader" ||
                    item.userId ===
                    res.locals
                        .currentUser
                        .userId;

                if (!canManage) {
                    req.flash(
                        "error",
                        "You can only delete your own retrospective entries."
                    );

                    return res.redirect(
                        "/retrospective"
                    );
                }

                const sql = `
                    DELETE FROM retrospective_items

                    WHERE retrospective_id = ?
                      AND project_id = ?
                `;

                db.query(
                    sql,

                    [
                        retrospectiveId,
                        projectId
                    ],

                    function (
                        deleteError
                    ) {
                        if (
                            deleteError
                        ) {
                            return next(
                                deleteError
                            );
                        }

                        addActivity(
                            projectId,

                            res.locals
                                .currentUser
                                .userId,

                            res.locals
                                .currentUser
                                .name +
                            " deleted a retrospective entry.",

                            function (
                                activityError
                            ) {
                                if (
                                    activityError
                                ) {
                                    return next(
                                        activityError
                                    );
                                }

                                req.flash(
                                    "success",
                                    "Retrospective entry deleted."
                                );

                                res.redirect(
                                    "/retrospective"
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(function (
    error,
    req,
    res,
    next
) {
    console.error(error);

    if (
        error instanceof
        multer.MulterError
    ) {
        if (
            error.code ===
            "LIMIT_FILE_SIZE"
        ) {
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

        return res.redirect(
            "/profile/edit"
        );
    }

    if (
        error.message ===
        "Only JPG, PNG and WEBP images are allowed."
    ) {
        req.flash(
            "error",
            error.message
        );

        return res.redirect(
            "/profile/edit"
        );
    }

    if (
        error.code ===
        "ER_NO_SUCH_TABLE"
    ) {
        return res
            .status(500)
            .send(
                "A required database table is missing. Run your database setup SQL first."
            );
    }

    if (
        error.code ===
        "ER_DUP_ENTRY"
    ) {
        req.flash(
            "error",
            "That value already exists in the database."
        );

        return res.redirect(
            req.get("referer") ||
            "/"
        );
    }

    res.status(500).send(
        "An unexpected server error occurred. Check the terminal for details."
    );
});

// =====================================================
// PAGE NOT FOUND
// =====================================================

app.use(function (
    req,
    res
) {
    res.status(404).send(
        "Page not found."
    );
});

// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    function () {
        console.log(
            "Server is running on http://localhost:" +
            PORT
        );
    }
);