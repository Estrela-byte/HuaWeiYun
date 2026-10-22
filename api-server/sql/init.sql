-- 极简经营者管理工具 建表脚本
-- 使用方法：在 MySQL 中执行 source sql/init.sql; 或用 Navicat 等工具打开运行

-- 创建数据库
CREATE DATABASE IF NOT EXISTS shop_manager
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE shop_manager;

-- 先删子表再删父表，避免外键冲突
DROP TABLE IF EXISTS backup_records;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS alert_records;
DROP TABLE IF EXISTS alert_thresholds;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

-- 1. 用户表
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录用户名',
  password_hash VARCHAR(255) NOT NULL        COMMENT '加密后的密码',
  shop_name     VARCHAR(100)                 COMMENT '店铺名称',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'
) COMMENT='用户表';

-- 2. 商品表
CREATE TABLE products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL                 COMMENT '所属用户',
  name          VARCHAR(100) NOT NULL        COMMENT '商品名称',
  unit          VARCHAR(20)                  COMMENT '单位（如 个/箱/斤）',
  purchase_price DECIMAL(10,2) DEFAULT 0     COMMENT '进货价',
  sell_price    DECIMAL(10,2) DEFAULT 0      COMMENT '售价',
  stock_qty     DECIMAL(10,2) DEFAULT 0      COMMENT '库存数量',
  remark        VARCHAR(255)                 COMMENT '备注',
  CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='商品表';

-- 3. 收支记录表
CREATE TABLE transactions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL                   COMMENT '所属用户',
  type       ENUM('income','expense') NOT NULL COMMENT '类型：收入/支出',
  amount     DECIMAL(10,2) NOT NULL         COMMENT '金额',
  category   VARCHAR(50)                    COMMENT '分类',
  note       VARCHAR(255)                   COMMENT '备注',
  happened_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='收支记录表';

-- 4. 预警阈值表（每用户一条）
CREATE TABLE alert_thresholds (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  user_id                INT NOT NULL UNIQUE             COMMENT '所属用户',
  cost_ratio_threshold   DECIMAL(5,2) DEFAULT 70         COMMENT '成本占比阈值(%)',
  income_drop_threshold  DECIMAL(5,2) DEFAULT 30         COMMENT '收入下降阈值(%)',
  profit_min_threshold   DECIMAL(10,2) DEFAULT 0         COMMENT '毛利下限',
  updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_thresholds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='预警阈值表';

-- 5. 预警记录表
CREATE TABLE alert_records (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL                   COMMENT '所属用户',
  type       VARCHAR(20) NOT NULL           COMMENT '预警类型：cost_ratio/income_drop/profit_low/no_transaction',
  title      VARCHAR(100) NOT NULL          COMMENT '预警标题',
  content    VARCHAR(500)                   COMMENT '预警内容',
  status     VARCHAR(20) DEFAULT 'pending'  COMMENT '状态：pending/ignored',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='预警记录表';

-- 6. 店铺成员表
CREATE TABLE members (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  owner_id       INT NOT NULL                 COMMENT '店铺所有者(邀请人)',
  member_user_id INT NOT NULL                 COMMENT '被邀请的用户',
  role           VARCHAR(10) DEFAULT 'staff'  COMMENT '角色：boss/staff',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_owner_member (owner_id, member_user_id),
  CONSTRAINT fk_members_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='店铺成员表';

-- 7. 备份记录表
CREATE TABLE backup_records (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL                   COMMENT '所属用户',
  backup_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '备份时间',
  file_name   VARCHAR(255)                   COMMENT '备份文件名',
  CONSTRAINT fk_backup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='备份记录表';