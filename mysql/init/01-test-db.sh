#!/bin/bash
# Creates the database the backend integration tests use (P-047). Calls the mysql client
# directly so it works whether the entrypoint runs this file (Windows mounts look
# executable) or sources it (Linux checkouts).
mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS mdit_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON mdit_test.* TO '$MYSQL_USER'@'%';
SQL
