CREATE TABLE IF NOT EXISTS users (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

INSERT INTO users (name, email) VALUES
  ('John Snow', 'john.snow@example.com'),
  ('John Doe',  'john.doe@example.com')
ON CONFLICT (email) DO NOTHING;