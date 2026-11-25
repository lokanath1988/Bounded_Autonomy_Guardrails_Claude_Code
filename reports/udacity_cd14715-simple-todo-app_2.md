# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 15/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 3 |
| **High Priority Tests** | 3 |
| **Refactoring Opportunities** | 1 |

## 🎯 Top Recommendations

1. 🚨 **security**: SQL injection vulnerability in searchTodos function. User input 'keyword' is directly interpolated into SQL query using template literals without parameterization or escaping.
   - Files: src/todo.ts

2. 🚨 **security**: SQL injection vulnerability in searchTodosByStatus function. User input 'completed' is directly concatenated into SQL query without parameterization, validation, or type checking.
   - Files: src/todo.ts

3. 🚨 **security**: SQL injection vulnerability in getTodosByUser function. User input 'userId' is directly interpolated into SQL query using template literals without parameterization or input validation.
   - Files: src/todo.ts

4. ⚠️ **test-coverage**: Missing tests for searchTodos (line 119): SQL injection vulnerability through unparameterized string interpolation. This is a severe security flaw that could allow attackers to execute arbitrary SQL commands.
   - Files: src/todo.ts

5. ⚠️ **test-coverage**: Missing tests for searchTodosByStatus (line 131): SQL injection vulnerability through string concatenation without validation or parameterized queries. Direct user input is concatenated into SQL query.
   - Files: src/todo.ts

## 📁 File Details

### 📄 `src/todo.ts`

**Quality Score:** 15/100 | **Coverage:** ~15%

#### Issues (7)
  - Line 119: `critical` SQL injection vulnerability in searchTodos function. User input 'keyword' is directly interpolated into SQL query using template literals without parameterization or escaping.
  - Line 128: `critical` SQL injection vulnerability in searchTodosByStatus function. User input 'completed' is directly concatenated into SQL query without parameterization, validation, or type checking.
  - Line 137: `critical` SQL injection vulnerability in getTodosByUser function. User input 'userId' is directly interpolated into SQL query using template literals without parameterization or input validation.

  *...and 4 more*

#### Test Gaps (9)
  - `searchTodos (line 119)` (critical priority)
  - `searchTodosByStatus (line 131)` (critical priority)

  *...and 7 more*

#### Refactoring Opportunities (3)
  - **pattern-improvement**: Critical security vulnerability: All three functions use SQL string concatenation/interpolation instead of parameterized queries, exposing the application to SQL injection attacks. This violates the established pattern used in deleteTodo and other functions that use parameterized queries with db.query(query, [params]).
  - **extract-function**: Three database query functions follow nearly identical patterns with query execution and type casting. Extract a generic database query helper to reduce duplication and improve maintainability.

  *...and 1 more*

---

*Generated at 2026-11-25T08:21:36.703Z • Duration: 0ms*
