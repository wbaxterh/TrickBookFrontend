import { commentCreatedProperties, postCreatedProperties } from '@/lib/analytics/properties';

describe('postCreatedProperties', () => {
  it('keeps ids, enums and counts only', () => {
    const properties = postCreatedProperties({
      _id: 'post1',
      mediaType: 'video',
      spotId: 'spot9',
      tricks: ['ollie', 'kickflip'],
      visibility: 'homies',
      // Fields the contract forbids; they must never leak into properties.
      ...({ caption: 'my secret caption', userId: 'u1', userName: 'Wes' } as object),
    });
    expect(properties).toEqual({
      post_id: 'post1',
      media_type: 'video',
      has_spot: true,
      trick_count: 2,
      visibility: 'homies',
    });
    expect(JSON.stringify(properties)).not.toMatch(/caption|Wes|u1/);
  });

  it('omits unknown fields instead of guessing and treats an embedded spot as has_spot', () => {
    expect(postCreatedProperties({ spot: { _id: 'spot2' } })).toEqual({
      has_spot: true,
      trick_count: 0,
    });
    expect(postCreatedProperties(null)).toEqual({ has_spot: false, trick_count: 0 });
  });
});

describe('commentCreatedProperties', () => {
  it('marks replies by the presence of a parent id', () => {
    expect(commentCreatedProperties('post1')).toEqual({ post_id: 'post1', is_reply: false });
    expect(commentCreatedProperties('post1', 'c7')).toEqual({ post_id: 'post1', is_reply: true });
    expect(commentCreatedProperties('post1', null)).toEqual({ post_id: 'post1', is_reply: false });
  });
});
