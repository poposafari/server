echo "Waiting for DB..."
./wait-for-it.sh db:5432 --timeout=60 --strict -- echo "DB is up"

echo "Starting socket server..."
npm run start:socket

echo "Starting ticket job server..."
npm run start:ticket-job