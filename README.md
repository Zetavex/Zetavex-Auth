<div align="center">
  <a href="">
    <img src="https://assets.zetavex.workers.dev/Zetavex%20full%20logo.svg" alt="Zetavex logo" width="500" />
  </a>
</div>

---

<div align="center">

<div>
  
  ![Static Badge](https://img.shields.io/badge/typescript-r?style=flat&logo=typescript&logoColor=white&label=Made%20with&labelColor=blue&color=white)
  ![Static Badge](https://img.shields.io/badge/100%25-r?style=flat&logoColor=white&label=Secure&labelColor=green&color=white)
  ![Static Badge](https://img.shields.io/badge/free%20%26%20open%20source-r?style=flat&logo=software&logoColor=white&label=Software&labelColor=orange&color=white)
  
</div>

<div align="center">

  [![Static Badge](https://img.shields.io/badge/Follow%20me-r?style=flat&logo=bluesky&logoColor=white&label=%40shaedow2000&labelColor=blue&color=white)]([https://x.com](https://x.com/shaedow2000))
  [![Static Badge](https://img.shields.io/badge/Follow%20me-r?style=flat&logo=x&logoColor=white&label=%40shaedow2000&labelColor=black&color=white)](https://bsky.app/profile/shaedow2000.bsky.social)
  
</div>
  
</div>

Auth api verification for Zetavex accounts.

Made Free and Open-source to build trust between us and our users!

---

# Stack

## Tech 

This API uses many technologies so that it can deliver the best experience:

- **NodeJS**
- **ExpressJS**
- **MongoDB**
- **Mongoose**
- **TypeScript**

## Security

We used many dependencies to make this API more secure:

- **Zod**
- **Validator**
- **UUID**
- **Cors**
- **JsonWebToken**
- **Bcryptjs**
- **Express-rate-limit**
- **Helmet**
- **Dotenv**

## Other

For more features, we used other dependencies:

- **Pino**
- **Pino pretty**
- **Nodemailer**

# Endpoints

All the endpoints of this API are under the `/auth` route.

## POST

### 1) `/register`
- This waits for `username: string | email: string | password: string` in req.body
- Responses:
  - Validation failed:
```json
{
  "status": 400,
  "message": {
    "field-name": "error message"
  }
}
```
  - Success (201):
```json
{
  "status": 201,
  "message": "New verification code sent to email"
}
```

### 2) `/verify`
- This waits for `code: number` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Code expired:
```json
{
  "status": 400,
  "message": "Verification code expired"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Verification successful"
}
```

### 3) `/resend`
- This waits for `email: string` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Already verified:
```json
{
  "status": 400,
  "message": "Account already verified"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "New verification code sent to email"
}
```

### 4) `/login`
- This waits for `email: string | password: string` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Account not verified:
```json
{
  "status": 401,
  "message": "Account is not verified"
}
```
  - Incorrect password:
```json
{
  "status": 401,
  "message": "Email or password are incorrect"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- Sets cookie: `Refresh-Token-Id`

### 5) `/logout`
- This waits for `Authorization: Bearer <token>` header and `Refresh-Token-Id` cookie
- Responses:
  - Session expired:
```json
{
  "status": 400,
  "message": "Session id already expired"
}
```
  - Invalid credentials:
```json
{
  "status": 404,
  "message": "Invalid cerdentials."
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Session ended successfully"
}
```

### 6) `/request/logout-all`
- This waits for `Authorization: Bearer <token>` header and `Refresh-Token-Id` cookie
- Responses:
  - Invalid credentials:
```json
{
  "status": 404,
  "message": "Invalid cerdentials."
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Verification code sent to email"
}
```

### 7) `/logout-all`
- This waits for `code: number` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Code expired:
```json
{
  "status": 400,
  "message": "Verification code expired"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Logout all devices successfully"
}
```

### 8) `/refresh`
- This waits for `Refresh-Token-Id` cookie
- Responses:
  - Session expired:
```json
{
  "status": 400,
  "message": "Session id already expired"
}
```
  - Invalid credentials:
```json
{
  "status": 404,
  "message": "Invalid cerdentials."
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Refreshed access token",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- Sets new cookie: `Refresh-Token-Id`

### 9) `/forgot-password`
- This waits for `email: string` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "New password reset code has been sent"
}
```

### 10) `/reset-password-token`
- This waits for `code: number` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Code expired:
```json
{
  "status": 400,
  "message": "Reset code already expired"
}
```
  - Invalid code:
```json
{
  "status": 400,
  "message": "Invalid reset code"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Reset permitted"
}
```
- Sets cookie: `PasswordResetUUID`

### 11) `/reset-password`
- This waits for `password: string` in req.body and `PasswordResetUUID` cookie
- Responses:
  - Token expired:
```json
{
  "status": 400,
  "message": "Operation non permitted. Cerdentials already expired. Please try again."
}
```
  - Invalid credentials:
```json
{
  "status": 404,
  "message": "Invalid cerdentials."
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Password reset successfully"
}
```
- Clears cookie: `PasswordResetUUID`

### 12) `/cancel-reset`
- This waits for `PasswordResetUUID` cookie
- Responses:
  - Token expired:
```json
{
  "status": 400,
  "message": "Operation canceled. Cerdentials already expired."
}
```
  - Invalid credentials:
```json
{
  "status": 404,
  "message": "Invalid cerdentials."
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Operation canceled"
}
```
- Clears cookie: `PasswordResetUUID`

### 13) `/delete-account-request`
- This waits for `email: string | password: string` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Incorrect password:
```json
{
  "status": 401,
  "message": "Email or password are incorrect"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "New verification code sent to email"
}
```

### 14) `/delete-account`
- This waits for `code: number` in req.body
- Responses:
  - Account not found:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Code expired:
```json
{
  "status": 400,
  "message": "Reset code already expired"
}
```
  - Success (204): No content

## GET

### 15) `/me`
- This waits for `Authorization: Bearer <token>` header
- Responses:
  - Invalid token:
```json
{
  "status": 404,
  "message": "Account not found"
}
```
  - Success (200):
```json
{
  "status": 200,
  "message": "Retrieved data for account",
  "account": {
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```
