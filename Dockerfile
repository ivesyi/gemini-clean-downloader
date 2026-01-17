FROM python:3.12-slim

WORKDIR /app

COPY service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY service /app

ENV BASE_DIR=/data
EXPOSE 17811

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "17811"]
