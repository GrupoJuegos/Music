import {expect,test} from 'vitest';
import {invitation,readInvitation} from './invite';

test('the QR contains a short URL with the session ID in its fragment',()=>{
  const id='abcdef0123456789abcdef0123456789';
  const url=invitation(id,'https://musicbridge.example');
  expect(url).toBe('https://musicbridge.example/#p='+id);
  expect(readInvitation(url)).toBe(id);
});

test('ignores unrelated and malformed links',()=>{
  expect(readInvitation('https://example.com/#p=bad')).toBeNull();
  expect(readInvitation('bad')).toBeNull();
});
