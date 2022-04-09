import React, { useCallback, useEffect, useState } from 'react';
import { useSpeechContext, ClientState } from '@speechly/react-client';
import classnames from 'classnames';
import Loader from 'react-spinners/SyncLoader';
import AvaTextComponent from './ava-speech.component';
import { wordsToSentence } from '../utils';
/* eslint-disable */
// @ts-ignore
import styles from './ava.module.scss';
import { processSegment } from './ava-commands';
import { AvaOptions, Line, SPEAKER } from './types';
import Tags from './tags';
/* eslint-enable */

export default function App(): React.ReactElement {
  // useStates
  // const [speech, setSpeech] = useState('');
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [renderTags, setRenderTags] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [contextIndex, setContextIndex] = useState<number | null>(null);
  const [dictation, setDictation] = useState<string | null>(null);
  const [submit, setSubmit] = useState(false);
  const [dialogue, setDialogue] = useState<Line[]>([]);

  const options: AvaOptions = {
    modalOptions: {
      openTagModal: () => setIsTagsModalOpen(true),
      closeTagModal: () => setIsTagsModalOpen(false),
    },
    setRenderTag: (value: boolean) => setRenderTags(value),
    setShowTag: (value: boolean) => setShowTags(value),
    setContextIndex: (index: number) => {
      setContextIndex(index);
    },
    setDictation: (newDictation: string) => setDictation(newDictation),
    setSubmit: () => setSubmit(true),
  };

  const { segment, clientState, startContext, stopContext, listening } =
    useSpeechContext();
  // const { segment, clientState, startContext, stopContext } =

  async function startListening() {
    try {
      await startContext();
    } catch (e) {
      console.error('failed to start listening');
      console.error(e);
    }
  }

  async function stopListening() {
    try {
      await stopContext();
      setDialogue([]);
    } catch (e) {
      console.error('failed to stop listening');
      console.error(e);
    }
  }

  function addLineToDialogue(speech: string, user = true) {
    if (dialogue.length >= 10) {
      setDialogue((prev) => {
        prev.shift();
        return [...prev];
      });
    }

    const line = {
      id: dialogue.length,
      speaker: user ? SPEAKER.USER : SPEAKER.AVA,
      text: speech,
      isFinal: !user,
    };

    setDialogue((prev) => [...prev, line]);
  }

  function updateLastLine(speech: string, isFinal = false) {
    const lastDialogue = dialogue[dialogue.length - 1];
    if (
      dialogue.length === 0 ||
      (lastDialogue &&
        (lastDialogue.speaker === SPEAKER.AVA || lastDialogue.isFinal))
    ) {
      addLineToDialogue(speech);
    } else {
      setDialogue((prev) => {
        const lastLine = prev.pop();

        if (lastLine) {
          return [...prev, { ...lastLine, text: speech, isFinal }];
        }

        return prev;
      });
    }
  }

  useEffect(() => {
    const port = chrome.runtime.connect();
    port.onMessage.addListener((isActiveTab) => {
      if (!isActiveTab) {
        stopListening();
        setShowTags(false);
      }
    });

    return () => {
      port.disconnect();
    };
  }, []);

  useEffect(() => {
    if (segment) {
      const { words, isFinal } = segment;

      const sentence = wordsToSentence(words);

      updateLastLine(sentence, isFinal);

      if (isFinal) {
        try {
          processSegment(segment, options);
        } catch (e) {
          if (e instanceof Error) {
            addLineToDialogue(e.message, false);
          }
        }
      }
    }
  }, [segment]);

  // const [listening, setListening] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, repeat, ctrlKey, altKey } = event;

      // eslint-disable-next-line no-useless-return
      if (repeat) return;

      if (ctrlKey && altKey && (key === 'z' || key === 'Z')) {
        if (!listening) {
          startListening();
        } else {
          stopListening();
        }
      } else if (ctrlKey && altKey && (key === 'c' || key === 'C')) {
        if (!listening) {
          // setListening(true);
          setTimeout(() => {
            setDialogue((prev) => [
              ...prev,
              {
                id: 0,
                speaker: SPEAKER.USER,
                text: 'Tags',
                isFinal: true,
              },
            ]);
          }, 2000);
          setTimeout(() => {
            setDialogue((prev) => [
              ...prev,
              {
                id: 1,
                speaker: SPEAKER.AVA,
                text: "I'm sorry, could you repeat that again",
                isFinal: true,
              },
            ]);
          }, 4000);
        } else {
          // setListening(false);
          setDialogue([]);
        }
      }
    },
    [listening]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);

    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [listening, handleKeyDown]);

  /* eslint-disable */
  return (
    <>
      <Tags
        isTagsModalOpen={isTagsModalOpen}
        showTags={showTags}
        renderTags={renderTags}
        setShowTags={(value: boolean) => setShowTags(value)}
        linkIndex={contextIndex}
        resetLinkIndex={() => setContextIndex(null)}
        dictation={dictation}
        resetDictation={() => setDictation(null)}
        submit={submit}
        resetSubmit={() => setSubmit(false)}
      />
      <div className={classnames(styles.app, listening && styles.active)}>
        {listening ? (
          <AvaTextComponent dialogue={dialogue} />
        ) : clientState < ClientState.Preinitialized ? (
          <Loader size={10} />
        ) : (
          <div>
            <p>A</p>
          </div>
        )}
      </div>
    </>
  );
}
/* eslint-enable */
