from fastapi.testclient import TestClient

from app.main import app
from app.services import document_service


client = TestClient(app)


def test_link_preview_rejects_invalid_url() -> None:
    response = client.post('/api/documents/link-preview', json={'url': 'not a url'})
    assert response.status_code == 400


def test_link_preview_returns_metadata(monkeypatch) -> None:
    def fake_extract_preview_metadata(url: str) -> dict[str, str]:
        assert url == 'https://project.feishu.cn/home'
        return {
            'title': '飞书项目',
            'description': '专业项目管理工具的第一选择',
            'site_name': '飞书项目',
            'image': 'https://project.feishu.cn/cover.png',
            'icon': 'https://project.feishu.cn/favicon.ico',
        }

    monkeypatch.setattr(document_service, 'extract_preview_metadata', fake_extract_preview_metadata)

    response = client.post('/api/documents/link-preview', json={'url': 'project.feishu.cn/home'})
    assert response.status_code == 200
    payload = response.json()
    assert payload['normalized_url'] == 'https://project.feishu.cn/home'
    assert payload['title'] == '飞书项目'
    assert payload['description'] == '专业项目管理工具的第一选择'
    assert payload['site_name'] == '飞书项目'
    assert payload['view'] == 'link'
    assert payload['status'] == 'ready'
