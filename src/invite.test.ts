import {expect,test} from 'vitest';import {invitation,readInvitation} from './invite';
test('single QR opens site and preserves offer in fragment',()=>{const url=invitation('MB1:a+b/==','https://musicbridge.example');expect(new URL(url).origin).toBe('https://musicbridge.example');expect(new URL(url).search).toBe('');expect(readInvitation(url)).toBe('MB1:a+b/==');});
test('ignores unrelated and malformed links',()=>{expect(readInvitation('https://example.com/#pair=bad')).toBeNull();expect(readInvitation('bad')).toBeNull();});
