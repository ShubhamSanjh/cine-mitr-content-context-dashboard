-- ============================================================
-- Content Dashboard — Sample Data (DML)
-- Purpose: Seed data for testing and demo purposes
-- ============================================================

-- Sample Movies
INSERT INTO media_content (media_category, media_name, release_date, genre, director, cast_members, rating, review)
VALUES
    ('movies', 'Inception', '2010-07-16', 'Sci-Fi, Thriller', 'Christopher Nolan', 'Leonardo DiCaprio, Tom Hardy, Elliot Page', 8.8, 'A mind-bending masterpiece about dream manipulation'),
    ('movies', 'The Dark Knight', '2008-07-18', 'Action, Crime, Drama', 'Christopher Nolan', 'Christian Bale, Heath Ledger, Aaron Eckhart', 9.0, 'Defining superhero film with legendary Joker performance'),
    ('movies', 'Interstellar', '2014-11-07', 'Sci-Fi, Adventure', 'Christopher Nolan', 'Matthew McConaughey, Anne Hathaway, Jessica Chastain', 8.7, 'Epic space exploration with emotional depth'),
    ('movies', 'Parasite', '2019-05-30', 'Thriller, Drama', 'Bong Joon-ho', 'Song Kang-ho, Lee Sun-kyun, Cho Yeo-jeong', 8.5, 'Brilliant social commentary through dark comedy');

-- Sample Web Series
INSERT INTO media_content (media_category, media_name, release_date, genre, director, cast_members, rating, review)
VALUES
    ('webseries', 'Breaking Bad', '2008-01-20', 'Crime, Drama, Thriller', 'Vince Gilligan', 'Bryan Cranston, Aaron Paul, Anna Gunn', 9.5, 'Greatest TV series ever made'),
    ('webseries', 'Stranger Things', '2016-07-15', 'Sci-Fi, Horror, Drama', 'Duffer Brothers', 'Millie Bobby Brown, Finn Wolfhard', 8.7, 'Nostalgic supernatural thriller'),
    ('webseries', 'The Witcher', '2019-12-20', 'Fantasy, Action', 'Lauren Schmidt', 'Henry Cavill, Anya Chalotra', 8.2, 'Epic fantasy adaptation');

-- Sample Shows
INSERT INTO media_content (media_category, media_name, release_date, genre, director, cast_members, rating, review)
VALUES
    ('shows', 'The Tonight Show', '2014-02-17', 'Talk Show, Comedy', 'Jimmy Fallon', 'Jimmy Fallon', 7.0, 'Entertaining late-night talk show'),
    ('shows', 'MasterChef', '2010-07-27', 'Reality, Cooking', 'Various', 'Gordon Ramsay, Joe Bastianich', 7.5, 'Competitive cooking at its best');

-- Sample Music
INSERT INTO media_content (media_category, media_name, release_date, genre, director, cast_members, rating, review)
VALUES
    ('music', 'Blinding Lights', '2019-11-29', 'Synth-pop, Electropop', 'The Weeknd', 'The Weeknd', 9.0, 'Iconic retro-synth track'),
    ('music', 'Bohemian Rhapsody', '1975-10-31', 'Rock, Opera', 'Queen', 'Freddie Mercury, Brian May', 9.8, 'Timeless masterpiece');

-- Sample Links
INSERT INTO media_links (media_id, platform, url, description)
VALUES
    (1, 'youtube', 'https://youtube.com/watch?v=YoHD9XEInc0', 'Official Inception Trailer'),
    (1, 'instagram', 'https://instagram.com/inception_movie', 'Inception fan page'),
    (5, 'youtube', 'https://youtube.com/watch?v=HhesaQXLuRY', 'Breaking Bad Trailer'),
    (5, 'twitter', 'https://twitter.com/BreakingBad', 'Official Twitter'),
    (11, 'spotify', 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b', 'Blinding Lights on Spotify');

-- Sample Status entries
INSERT INTO media_status (media_id, status, notes, updated_by)
VALUES
    (1, 'reviewed', 'Watched and reviewed', 'admin'),
    (2, 'reviewed', 'Classic, rewatched', 'admin'),
    (3, 'in_progress', 'Currently watching', 'admin'),
    (5, 'reviewed', 'Completed all seasons', 'admin'),
    (6, 'in_progress', 'On season 3', 'admin'),
    (7, 'planned', 'Want to watch next', 'admin'),
    (8, 'stopped', 'Lost interest after season 2', 'admin');

-- Sample Tasks
INSERT INTO todo_tasks (title, description, due_date, priority, category, media_id, status)
VALUES
    ('Watch Interstellar', 'Rewatch with surround sound setup', '2026-05-18', 'medium', 'media', 3, 'pending'),
    ('Review Breaking Bad S5', 'Write detailed review of final season', '2026-05-20', 'high', 'media', 5, 'in_progress'),
    ('Update Instagram links', 'Add missing social media links for all movies', '2026-05-22', 'low', 'general', NULL, 'pending'),
    ('Create monthly report', 'Generate media consumption report for May', '2026-05-31', 'high', 'project', NULL, 'pending'),
    ('Add new music entries', 'Add recently discovered albums', '2026-05-16', 'medium', 'media', NULL, 'completed');

