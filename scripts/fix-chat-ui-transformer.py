from pathlib import Path

path = Path('scripts/apply-chat-ui-completion.py')
source = path.read_text()
old = """old_edit_click = \"\"\"                          setEditingText(message.content || '');
                          setIsEditing(true);
                          closeContextMenu();
\"\"\"
new_edit_click = \"\"\"                          if (onRequestEditMessage) {
                            onRequestEditMessage(message);
                          } else {
                            setEditingText(message.content || '');
                            setIsEditing(true);
                          }
                          closeContextMenu();
\"\"\"
if old_edit_click not in bubble:
    raise SystemExit('MessageBubble edit menu handler missing')
bubble_path.write_text(bubble.replace(old_edit_click, new_edit_click, 1))
"""
new = """old_edit_click = \"\"\"                  if (entry.label === 'Edit') {
                    setIsEditing(true);
                  }
\"\"\"
new_edit_click = \"\"\"                  if (entry.label === 'Edit') {
                    if (onRequestEditMessage) {
                      onRequestEditMessage(message);
                    } else {
                      setEditingText(message.content || '');
                      setIsEditing(true);
                    }
                  }
\"\"\"
if old_edit_click not in bubble:
    raise SystemExit('MessageBubble edit menu handler missing')
bubble_path.write_text(bubble.replace(old_edit_click, new_edit_click, 1))
"""
if old not in source:
    raise SystemExit('Outdated MessageBubble transformer block not found')
path.write_text(source.replace(old, new, 1))
