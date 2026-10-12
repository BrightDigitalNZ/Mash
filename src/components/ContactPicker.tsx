// Who matched, and who could be invited. Names and faces come from the phone and stay in memory
// for this session only. The server has seen hashes and nothing else.
// Content only: the parent Screen owns scrolling and padding.

import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Caption, Empty, Field, Heading, ListRow, Stack } from '@/components/ui';
import type { MatchContactsResult } from '@/lib/api';
import type { LocalContact } from '@/lib/contacts';
import { copy } from '@/lib/copy';
import { spacing } from '@/theme';

const PAGE = 40;

export type MatchedPerson = MatchContactsResult['matched'][number];

function roleLabel(role: MatchedPerson['role']): string {
  if (role === 'catch') return 'A Catch';
  if (role === 'mashmaker') return 'A Mashmaker';
  return 'On Mash';
}

export default function ContactPicker({
  matched,
  contacts,
  excludeHashes = [],
  invited = [],
  onInvite,
  showMatched = true,
}: {
  /** people already on Mash whose number is in this phone */
  matched: MatchedPerson[];
  /** everyone in the phone with a usable number */
  contacts: LocalContact[];
  /** hashes to leave out of the invite list: my own number, people already on Mash */
  excludeHashes?: string[];
  /** contact ids already invited this session, shown as "Invited" */
  invited?: string[];
  onInvite: (contact: LocalContact) => void;
  showMatched?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const notOnMash = useMemo(() => {
    const exclude = new Set([
      ...excludeHashes,
      ...matched.map((m) => m.hash).filter((h): h is string => !!h),
    ]);
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (c.hashes.some((h) => exclude.has(h))) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    });
  }, [contacts, excludeHashes, matched, query]);

  const invitedSet = useMemo(() => new Set(invited), [invited]);
  const shown = notOnMash.slice(0, limit);

  return (
    <Stack gap={spacing.xl}>
      {showMatched ? (
        <Stack gap={spacing.sm}>
          <Heading>Already on Mash</Heading>
          {matched.length === 0 ? (
            <Caption>{copy.empty.contacts}</Caption>
          ) : (
            matched.map((p) => (
              <ListRow
                key={p.id}
                title={p.first_name}
                subtitle={roleLabel(p.role)}
                left={<Avatar uri={p.photo_url} name={p.first_name} size={44} />}
              />
            ))
          )}
        </Stack>
      ) : null}

      <Stack gap={spacing.sm}>
        <Heading>Not on Mash yet</Heading>
        <Caption>An invite goes from your phone, in your words. Mash never contacts them.</Caption>
        <Field
          placeholder="Search your contacts"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setLimit(PAGE);
          }}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel="Search your contacts"
        />
        {shown.length === 0 ? (
          <Empty
            title={query ? 'No one by that name' : 'No one to invite'}
            body={query ? 'Try a shorter search.' : 'Contacts with a phone number show up here.'}
          />
        ) : (
          <View>
            {shown.map((c) => {
              const done = invitedSet.has(c.id);
              return (
                <ListRow
                  key={c.id}
                  title={c.name}
                  left={<Avatar uri={c.image} name={c.name} size={44} />}
                  right={
                    done ? (
                      <Caption>Invited</Caption>
                    ) : (
                      <Button
                        title="Invite"
                        variant="secondary"
                        small
                        full={false}
                        onPress={() => onInvite(c)}
                        accessibilityLabel={`Invite ${c.name}`}
                      />
                    )
                  }
                />
              );
            })}
            {notOnMash.length > shown.length ? (
              <Button title="Show more" variant="ghost" onPress={() => setLimit((n) => n + PAGE)} />
            ) : null}
          </View>
        )}
      </Stack>
    </Stack>
  );
}
