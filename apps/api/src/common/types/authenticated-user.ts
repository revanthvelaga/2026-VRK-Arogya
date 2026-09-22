// Shape of request.user once JwtStrategy.validate() has run.
export interface AuthenticatedUser {
  userId: string;
  phone?: string;
  role: string;
}
