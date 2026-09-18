# Auth flow — register, login, and every request after that

## Register

```mermaid
sequenceDiagram
    actor U as New user
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant Users as UsersService
    participant DB as PostgreSQL

    U->>Ctrl: POST /auth/register<br/>{fullName, phone, password}
    Ctrl->>Svc: register(dto)
    Svc->>Users: create({...dto, role: CUSTOMER})
    Note right of Svc: role is always forced to CUSTOMER here —<br/>public self-signup can never create<br/>an ADMIN/STAFF account
    Users->>DB: SELECT * FROM users WHERE phone = ?
    alt phone already registered
        DB-->>Users: existing row
        Users-->>Svc: throw ConflictException
        Svc-->>Ctrl: 409 Conflict
        Ctrl-->>U: 409 Conflict
    end
    Users->>Users: bcrypt.hash(password, 10)
    Users->>DB: INSERT INTO users (...)
    DB-->>Users: new User row
    Users-->>Svc: User
    Svc->>Svc: sign accessToken (15m) + refreshToken (7d)
    Svc-->>Ctrl: {accessToken, refreshToken, role}
    Ctrl-->>U: 201 Created
```

## Login

```mermaid
sequenceDiagram
    actor U as User
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant Users as UsersService
    participant DB as PostgreSQL

    U->>Ctrl: POST /auth/login<br/>{phone, password}
    Ctrl->>Svc: login(dto)
    Svc->>Users: findByPhone(phone)
    Users->>DB: SELECT * FROM users WHERE phone = ?
    DB-->>Users: row or null
    Users-->>Svc: User | null
    alt no user with that phone
        Svc-->>Ctrl: throw UnauthorizedException
        Ctrl-->>U: 401 Unauthorized
    end
    Svc->>Users: validatePassword(user, password)
    Users->>Users: bcrypt.compare(password, user.passwordHash)
    Users-->>Svc: boolean
    alt password doesn't match
        Svc-->>Ctrl: throw UnauthorizedException
        Ctrl-->>U: 401 Unauthorized
    end
    Svc->>Svc: sign accessToken (15m) + refreshToken (7d)
    Svc-->>Ctrl: {accessToken, refreshToken, role}
    Ctrl-->>U: 200 OK
```

## Every request after that

The client sends `Authorization: Bearer <accessToken>` on protected
routes. `JwtStrategy` (`passport-jwt`) verifies the signature and
expiry, then decodes the payload into `request.user`:

```mermaid
graph LR
    Token["JWT payload<br/>{ sub, phone, role }"] --> Validate["JwtStrategy.validate()"]
    Validate --> ReqUser["request.user =<br/>{ userId, phone, role }"]
    ReqUser --> Guards["RolesGuard reads<br/>request.user.role"]
    ReqUser --> Decorator["@CurrentUser() decorator<br/>hands it to controllers"]
```

Nothing queries the database again on every request — the JWT itself
carries `userId`/`phone`/`role`, so authorization is a pure in-memory
check against the decoded token until the access token expires (15
minutes) and the client needs to use the refresh token to get a new one.
