# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 82/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 0 |
| **High Priority Tests** | 4 |
| **Refactoring Opportunities** | 0 |

## 🎯 Top Recommendations

1. ⚠️ **test-coverage**: Missing tests for isValidEmail (line 25): Core validation function used in createUser for input validation. Incorrect email validation could allow invalid emails into the system.
   - Files: fixtures/clean-code.ts

2. ⚠️ **test-coverage**: Missing tests for sanitizeInput (line 32): Security-critical function that prevents XSS attacks. Any gaps in sanitization could lead to XSS vulnerabilities.
   - Files: fixtures/clean-code.ts

3. ⚠️ **test-coverage**: Missing tests for createUser (line 41): Core business logic function that creates users with validation, sanitization, and database operations. Complex control flow with multiple validation branches.
   - Files: fixtures/clean-code.ts

4. ⚠️ **test-coverage**: Missing tests for createUser - validation checks (lines 44-50): Multiple validation branches that must all be tested to ensure proper error handling and prevent invalid data persistence.
   - Files: fixtures/clean-code.ts

## 📁 File Details

### 📄 `fixtures/clean-code.ts`

**Quality Score:** 82/100 | **Coverage:** ~0%

#### Issues (4)
  - Line 25: `medium` Email validation regex is too simplistic and may not comply with RFC 5322. It could allow invalid email formats that pass the test but fail in real-world scenarios.
  - Line 72: `medium` The generateId() function uses Math.random() which is not cryptographically secure. For user IDs used in a database, this could lead to predictable IDs that may be guessed or exploited.
  - Line 50: `low` Email input is not sanitized before being stored, only the name is. While email validation helps, it's inconsistent to sanitize one field but not the other.

  *...and 1 more*

#### Test Gaps (10)
  - `isValidEmail (line 25)` (critical priority)
  - `sanitizeInput (line 32)` (critical priority)

  *...and 8 more*

#### Refactoring Opportunities (4)
  - **extract-function**: Input validation logic is mixed with user creation. Extract validation into a separate function to improve separation of concerns and make validation reusable.
  - **modernize**: Consider using a more robust email validation approach. The current regex is overly simplistic and may reject valid email formats per RFC 5322.

  *...and 2 more*

---

*Generated at 2026-11-25T08:17:53.552Z • Duration: 0ms*
