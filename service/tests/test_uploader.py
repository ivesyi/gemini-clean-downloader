import os
import sys
import tempfile
import unittest
from unittest.mock import patch
from requests.exceptions import ReadTimeout

CURRENT_DIR = os.path.dirname(__file__)
SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

from uploader import build_full_url, parse_upload_response, upload_file, handle_upload


class DummyResp:
    def __init__(self, data, status=200):
        self._data = data
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception("HTTP %s" % self.status_code)

    def json(self):
        return self._data


class UploaderTests(unittest.TestCase):
    def test_build_full_url_relative(self):
        api_url = "https://cfbed.sanyue.de/upload?authCode=abc"
        self.assertEqual(
            build_full_url(api_url, "/file/abc.jpg"),
            "https://cfbed.sanyue.de/file/abc.jpg",
        )

    def test_build_full_url_absolute(self):
        api_url = "https://cfbed.sanyue.de/upload?authCode=abc"
        self.assertEqual(
            build_full_url(api_url, "https://cdn.test/img.png"),
            "https://cdn.test/img.png",
        )

    def test_parse_upload_response_list(self):
        self.assertEqual(parse_upload_response([{ "src": "/file/abc.jpg" }]), "/file/abc.jpg")

    def test_parse_upload_response_dict(self):
        self.assertEqual(
            parse_upload_response({"data": [{ "src": "/file/abc.jpg" }]}),
            "/file/abc.jpg",
        )

    @patch("uploader.requests.post")
    def test_upload_file(self, post):
        post.return_value = DummyResp([{ "src": "/file/abc.jpg" }])
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            ok, url = upload_file("https://cfbed.sanyue.de/upload?authCode=abc", f.name)
        self.assertTrue(ok)
        self.assertEqual(url, "https://cfbed.sanyue.de/file/abc.jpg")

    @patch("uploader.requests.post")
    def test_upload_file_retries_on_timeout(self, post):
        post.side_effect = [ReadTimeout("boom"), DummyResp([{ "src": "/file/abc.jpg" }])]
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            ok, url = upload_file("https://cfbed.sanyue.de/upload?authCode=abc", f.name)
        self.assertTrue(ok)
        self.assertEqual(url, "https://cfbed.sanyue.de/file/abc.jpg")
        self.assertEqual(post.call_count, 2)

    @patch("uploader.requests.post")
    def test_upload_file_timeout_returns_error(self, post):
        post.side_effect = ReadTimeout("boom")
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            ok, err = upload_file("https://cfbed.sanyue.de/upload?authCode=abc", f.name)
        self.assertFalse(ok)
        self.assertTrue(str(err))

    @patch("uploader.upload_file")
    def test_handle_upload_deletes_on_success(self, upload_file_mock):
        upload_file_mock.return_value = (True, "https://cfbed.sanyue.de/file/abc.jpg")
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        try:
            ok, url, deleted = handle_upload(
                "https://cfbed.sanyue.de/upload?authCode=abc",
                tmp.name,
                delete_after=True,
            )
            self.assertTrue(ok)
            self.assertEqual(url, "https://cfbed.sanyue.de/file/abc.jpg")
            self.assertTrue(deleted)
            self.assertFalse(os.path.exists(tmp.name))
        finally:
            if os.path.exists(tmp.name):
                os.remove(tmp.name)


if __name__ == "__main__":
    unittest.main()
