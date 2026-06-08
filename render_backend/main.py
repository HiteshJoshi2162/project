import os
import json
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ChallengeRequired

app = FastAPI(title="Instagram Media Saver API")

# Root Route
@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "Instagram Media Saver API Running 🚀",
        "docs": "/docs",
        "endpoints": {
            "login": "/login",
            "download_reel": "/download/reel",
            "download_post": "/download/post",
            "stories": "/stories",
            "logout": "/logout"
        }
    }

# Health Check
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Instagram Media Saver API"
    }


# Simple session storage - In production, use a database or encrypted storage
SESSION_DIR = "sessions"
if not os.path.exists(SESSION_DIR):
    os.makedirs(SESSION_DIR)

class LoginRequest(BaseModel):
    username: str
    password: str

class DownloadRequest(BaseModel):
    url: str

class MediaItem(BaseModel):
    type: str # "image", "video"
    url: str
    thumbnail: Optional[str] = None

class StoryItem(BaseModel):
    id: str
    pk: str
    type: str
    url: str
    thumbnail: Optional[str] = None

class UserStoriesResponse(BaseModel):
    user_id: str
    username: str
    stories: List[StoryItem]

def get_client(username: Optional[str] = None) -> Client:
    cl = Client()
    if username:
        session_path = os.path.join(SESSION_DIR, f"{username}.json")
        if os.path.exists(session_path):
            cl.load_settings(session_path)
    return cl

@app.post("/login")
async def login(request: LoginRequest):
    cl = Client()
    session_path = os.path.join(SESSION_DIR, f"{request.username}.json")

    try:
        if os.path.exists(session_path):
            cl.load_settings(session_path)
            try:
                cl.get_timeline_feed() # Test if session is still valid
                return {"status": "success", "message": "Session restored", "username": request.username}
            except LoginRequired:
                pass # Session expired, re-login

        cl.login(request.username, request.password)
        cl.dump_settings(session_path)
        return {"status": "success", "message": "Login successful", "username": request.username}
    except ChallengeRequired:
        raise HTTPException(status_code=403, detail="Login challenge required. Please log in via browser.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/download/reel")
async def download_reel(request: DownloadRequest, username: str):
    cl = get_client(username)
    try:
        media_pk = cl.media_pk_from_url(request.url)
        media_info = cl.media_info(media_pk)

        if media_info.media_type == 2: # Video
            return {
                "status": "success",
                "media": [{"type": "video", "url": str(media_info.video_url), "thumbnail": str(media_info.thumbnail_url)}]
            }
        else:
            raise HTTPException(status_code=400, detail="Provided URL is not a reel/video")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download/post")
async def download_post(request: DownloadRequest, username: str):
    cl = get_client(username)
    try:
        media_pk = cl.media_pk_from_url(request.url)
        media_info = cl.media_info(media_pk)

        results = []
        if media_info.media_type == 1: # Image
            results.append({"type": "image", "url": str(media_info.thumbnail_url)})
        elif media_info.media_type == 2: # Video
            results.append({"type": "video", "url": str(media_info.video_url)})
        elif media_info.media_type == 8: # Album/Carousel
            for resource in media_info.resources:
                if resource.media_type == 1:
                    results.append({"type": "image", "url": str(resource.thumbnail_url)})
                elif resource.media_type == 2:
                    results.append({"type": "video", "url": str(resource.video_url)})

        return {"status": "success", "media": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stories")
async def get_all_stories(username: str):
    cl = get_client(username)
    try:
        # Get stories from followed users
        # This is a bit complex with instagrapi in one call,
        # usually you get followed users first or use cl.get_reels_tray()
        tray = cl.get_reels_tray()
        users_with_stories = []
        for reel in tray:
            users_with_stories.append({
                "user_id": reel.user.pk,
                "username": reel.user.username,
                "full_name": reel.user.full_name,
                "profile_pic": str(reel.user.profile_pic_url)
            })
        return {"status": "success", "users": users_with_stories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stories/{user_id}")
async def get_user_stories(user_id: str, username: str):
    cl = get_client(username)
    try:
        stories = cl.user_stories(user_id)
        results = []
        for story in stories:
            story_type = "image" if story.media_type == 1 else "video"
            url = str(story.thumbnail_url) if story_type == "image" else str(story.video_url)
            results.append({
                "id": story.id,
                "pk": story.pk,
                "type": story_type,
                "url": url,
                "thumbnail": str(story.thumbnail_url)
            })
        return {"status": "success", "user_id": user_id, "stories": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/logout")
async def logout(username: str):
    session_path = os.path.join(SESSION_DIR, f"{username}.json")
    if os.path.exists(session_path):
        os.remove(session_path)
    return {"status": "success", "message": "Logged out and session cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
