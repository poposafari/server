# echo "Waiting for Redis..."
# ./wait-for-it.sh redis:6379 --timeout=60 --strict -- echo "Redis is up"

echo "Waiting for DB..."
./wait-for-it.sh db0:5432 --timeout=60 --strict -- echo "DB is up"

echo "Starting socket server..."
npm run start:socket