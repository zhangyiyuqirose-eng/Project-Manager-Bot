-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'pm',
    "status" TEXT NOT NULL DEFAULT 'active',
    "login_error_count" INTEGER NOT NULL DEFAULT 0,
    "lock_end_time" DATETIME,
    "last_login_time" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "operation_type" TEXT NOT NULL,
    "operation_content" TEXT,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "param_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "template_name" TEXT NOT NULL,
    "config_content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "param_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "project_code" TEXT,
    "project_name" TEXT NOT NULL,
    "project_type" TEXT,
    "contract_amount" REAL,
    "pre_sale_ratio" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL NOT NULL DEFAULT 0.06,
    "external_labor_cost" REAL NOT NULL DEFAULT 0,
    "external_software_cost" REAL NOT NULL DEFAULT 0,
    "other_cost" REAL NOT NULL DEFAULT 0,
    "current_manpower_cost" REAL NOT NULL DEFAULT 0,
    "devops_progress" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "doc_name" TEXT NOT NULL,
    "doc_path" TEXT,
    "doc_type" TEXT NOT NULL DEFAULT 'requirement',
    "parse_status" TEXT NOT NULL DEFAULT 'pending',
    "parse_result" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "complexity_config" TEXT,
    "system_coefficient" TEXT,
    "process_coefficient" TEXT,
    "tech_stack_coefficient" TEXT,
    "unit_price_config" TEXT,
    "management_coefficient" REAL NOT NULL DEFAULT 0.2,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "estimate_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "total_man_day" REAL NOT NULL,
    "total_cost" REAL NOT NULL,
    "module_count" INTEGER NOT NULL DEFAULT 0,
    "man_month" REAL NOT NULL,
    "stage_detail" TEXT,
    "team_detail" TEXT,
    "calc_trace" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estimate_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "level" TEXT NOT NULL,
    "daily_cost" REAL NOT NULL,
    "role" TEXT,
    "entry_time" DATETIME,
    "leave_time" DATETIME,
    "is_to_end" BOOLEAN NOT NULL DEFAULT false,
    "reported_hours" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_costs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "contract_amount" REAL NOT NULL,
    "pre_sale_ratio" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL NOT NULL DEFAULT 0.06,
    "external_labor_cost" REAL NOT NULL DEFAULT 0,
    "external_software_cost" REAL NOT NULL DEFAULT 0,
    "other_cost" REAL NOT NULL DEFAULT 0,
    "current_manpower_cost" REAL NOT NULL DEFAULT 0,
    "available_cost" REAL NOT NULL DEFAULT 0,
    "daily_manpower_cost" REAL NOT NULL DEFAULT 0,
    "available_days" INTEGER NOT NULL DEFAULT 0,
    "burnout_date" DATETIME,
    "calc_time" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_costs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cost_deviations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "project_name" TEXT,
    "total_contract_amount" REAL NOT NULL,
    "current_cost_consumption" REAL NOT NULL DEFAULT 0,
    "devops_progress" REAL NOT NULL DEFAULT 0,
    "task_progress" REAL NOT NULL DEFAULT 0,
    "cost_deviation" REAL NOT NULL DEFAULT 0,
    "baseline_type" TEXT NOT NULL DEFAULT 'default',
    "baseline_config" TEXT,
    "expected_stages" TEXT,
    "actual_stages" TEXT,
    "team_costs" TEXT,
    "ai_suggestion" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cost_deviations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");
