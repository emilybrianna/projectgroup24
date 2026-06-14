import bcrypt from "bcryptjs";

bcrypt.setRandomFallback((length) =>
  Array.from({ length }, () => Math.floor(Math.random() * 256))
);

export default bcrypt;
