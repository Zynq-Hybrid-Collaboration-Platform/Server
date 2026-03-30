import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UserModel } from "../models/auth.model";
import { config } from "./env";
import { logger } from "../logger/logger";

if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: `http://localhost:5000/api/v1/auth/google/callback`,
        passReqToCallback: true,
      },
      async (_req, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0].value;
          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          // Check if user exists by googleId
          let user = await UserModel.findOne({ googleId: profile.id });

          if (user) {
            return done(null, user);
          }

          // Link account if email matches
          user = await UserModel.findOne({ email });

          if (user) {
            user.googleId = profile.id;
            if (!user.avatar && profile.photos?.[0].value) {
              user.avatar = profile.photos[0].value;
            }
            await user.save();
            return done(null, user);
          }

          // Create new user
          const newUser = await UserModel.create({
            name: profile.displayName,
            email: email,
            username: email.split("@")[0] + Math.floor(Math.random() * 1000),
            googleId: profile.id,
            avatar: profile.photos?.[0].value || "",
            status: "online",
          });

          logger.info("New user created via Google Auth", { userId: newUser._id });
          return done(null, newUser);
        } catch (err) {
          logger.error("Error in Google Strategy", { err });
          return done(err as Error);
        }
      }
    )
  );
} else {
  logger.warn("Google Auth is disabled: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.");
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
