from uvicorn import run


def main() -> None:
    run("threatflix_ueba.app:app", host="127.0.0.1", port=8001)
