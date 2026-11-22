import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


# ruleid: label-suite-cors-wildcard-origin
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# ruleid: label-suite-cors-wildcard-origin
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "*"], allow_credentials=True)

# ruleid: label-suite-cors-wildcard-origin
app.add_middleware(CORSMiddleware, allow_origins="*")

# ruleid: label-suite-cors-wildcard-origin
CORSMiddleware(app, allow_origins=["*"])

# ok: label-suite-cors-wildcard-origin
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"])

origins = ["http://localhost:5173"]
# ok: label-suite-cors-wildcard-origin
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

# ruleid: label-suite-hardcoded-secret
api_key = "sk-live-abc123"

# ruleid: label-suite-hardcoded-secret
DB_PASSWORD = "hunter2"

# ruleid: label-suite-hardcoded-secret
config = {"secret": "abc"}


def connect(**kwargs):
    return kwargs


# ruleid: label-suite-hardcoded-secret
connect(token="abc")

# ok: label-suite-hardcoded-secret
api_key = os.environ["API_KEY"]

# ok: label-suite-hardcoded-secret
token = os.getenv("TOKEN", "")

# ok: label-suite-hardcoded-secret
password = ""

# ok: label-suite-hardcoded-secret
app_name = "label-suite"

# ok: label-suite-hardcoded-secret
connect(token=os.environ["TOKEN"])
