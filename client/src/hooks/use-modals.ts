import { useState, useCallback, useEffect } from 'react';

export interface ModalState {
  // Artist Selection Modal
  showArtistModal: boolean;
  selectedArtistName: string;
  
  // Collaboration Details Popup
  showCollaborationPopup: boolean;
  collaborationArtist: string;
  collaborationCollaborator: string;
  mainArtistName: string;
}

export interface ModalActions {
  // Artist Modal Actions
  openArtistModal: (artistName: string) => void;
  closeArtistModal: () => void;
  
  // Collaboration Popup Actions
  openCollaborationPopup: (data: {
    artist: string;
    collaborator: string;
    mainArtistName: string;
  }) => void;
  closeCollaborationPopup: () => void;
  
  // Artist Selection Handler
  handleArtistSelection: (artistId: string, musicNerdBaseUrl?: string) => void;
  
  // Utility Actions
  closeAllModals: () => void;
  isAnyModalOpen: boolean;
}

export interface UseModalsProps {
  musicNerdBaseUrl?: string;
  onArtistSelection?: (artistId: string) => void;
}

/**
 * Custom hook for managing modal states and interactions
 * Handles artist selection modal and collaboration details popup
 */
export function useModals({ 
  musicNerdBaseUrl, 
  onArtistSelection 
}: UseModalsProps = {}): ModalState & ModalActions {
  // Artist Selection Modal State
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState('');
  
  // Collaboration Details Popup State
  const [showCollaborationPopup, setShowCollaborationPopup] = useState(false);
  const [collaborationArtist, setCollaborationArtist] = useState('');
  const [collaborationCollaborator, setCollaborationCollaborator] = useState('');
  const [mainArtistName, setMainArtistName] = useState('');

  // Persist modal state in sessionStorage to survive tab switches
  useEffect(() => {
    const modalState = {
      showArtistModal,
      selectedArtistName,
      showCollaborationPopup,
      collaborationArtist,
      collaborationCollaborator,
      mainArtistName
    };
    
    if (showArtistModal || showCollaborationPopup) {
      sessionStorage.setItem('modalState', JSON.stringify(modalState));
      console.log('🔧 [Modal] Persisting modal state:', modalState);
    } else {
      sessionStorage.removeItem('modalState');
    }
  }, [showArtistModal, selectedArtistName, showCollaborationPopup, collaborationArtist, collaborationCollaborator, mainArtistName]);

  // Restore modal state on component mount and page visibility changes
  useEffect(() => {
    const restoreModalState = () => {
      const saved = sessionStorage.getItem('modalState');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          console.log('🔧 [Modal] Restoring modal state:', state);
          
          if (state.showArtistModal) {
            setShowArtistModal(true);
            setSelectedArtistName(state.selectedArtistName || '');
          }
          
          if (state.showCollaborationPopup) {
            setShowCollaborationPopup(true);
            setCollaborationArtist(state.collaborationArtist || '');
            setCollaborationCollaborator(state.collaborationCollaborator || '');
            setMainArtistName(state.mainArtistName || '');
          }
        } catch (error) {
          console.error('🔧 [Modal] Error restoring modal state:', error);
          sessionStorage.removeItem('modalState');
        }
      }
    };

    // Restore on mount
    restoreModalState();

    // Restore on page visibility change (tab switching back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔧 [Modal] Page became visible, checking for modal state to restore');
        // Add a small delay to ensure page is fully loaded
        setTimeout(() => {
          restoreModalState();
        }, 100);
      }
    };

    const handlePageShow = () => {
      console.log('🔧 [Modal] Page show event, checking for modal state to restore');
      // Add a small delay to ensure page is fully loaded
      setTimeout(() => {
        restoreModalState();
      }, 100);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // Artist Modal Actions
  const openArtistModal = useCallback((artistName: string) => {
    setSelectedArtistName(artistName);
    setShowArtistModal(true);
  }, []);

  const closeArtistModal = useCallback(() => {
    setShowArtistModal(false);
    setSelectedArtistName('');
    // Clean up persisted state when deliberately closing
    const saved = sessionStorage.getItem('modalState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        state.showArtistModal = false;
        state.selectedArtistName = '';
        if (!state.showCollaborationPopup) {
          sessionStorage.removeItem('modalState');
        } else {
          sessionStorage.setItem('modalState', JSON.stringify(state));
        }
      } catch (error) {
        sessionStorage.removeItem('modalState');
      }
    }
  }, []);

  // Collaboration Popup Actions
  const openCollaborationPopup = useCallback((data: {
    artist: string;
    collaborator: string;
    mainArtistName: string;
  }) => {
    setCollaborationArtist(data.artist);
    setCollaborationCollaborator(data.collaborator);
    setMainArtistName(data.mainArtistName);
    setShowCollaborationPopup(true);
  }, []);

  const closeCollaborationPopup = useCallback(() => {
    setShowCollaborationPopup(false);
    setCollaborationArtist('');
    setCollaborationCollaborator('');
    setMainArtistName('');
    // Clean up persisted state when deliberately closing
    const saved = sessionStorage.getItem('modalState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        state.showCollaborationPopup = false;
        state.collaborationArtist = '';
        state.collaborationCollaborator = '';
        state.mainArtistName = '';
        if (!state.showArtistModal) {
          sessionStorage.removeItem('modalState');
        } else {
          sessionStorage.setItem('modalState', JSON.stringify(state));
        }
      } catch (error) {
        sessionStorage.removeItem('modalState');
      }
    }
  }, []);

  // Artist Selection Handler
  const handleArtistSelection = useCallback((artistId: string, baseUrl?: string) => {
    const urlToUse = baseUrl || musicNerdBaseUrl;
    
    if (!urlToUse) {
      console.error('🔧 [Config] MusicNerd base URL not available');
      return;
    }

    if (!artistId) {
      console.error('🔧 [Modal] Artist ID is required for selection');
      return;
    }

    const musicNerdUrl = `${urlToUse}/artist/${artistId}`;
    console.log(`🎵 Opening selected artist page: ${musicNerdUrl}`);
    
    try {
      const link = document.createElement('a');
      link.href = musicNerdUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Call optional callback
      onArtistSelection?.(artistId);
    } catch (error) {
      console.error('🔧 [Modal] Failed to open artist page:', error);
    }
  }, [musicNerdBaseUrl, onArtistSelection]);

  // Utility Actions
  const closeAllModals = useCallback(() => {
    closeArtistModal();
    closeCollaborationPopup();
    // Clean up all persisted state
    sessionStorage.removeItem('modalState');
    console.log('🔧 [Modal] Cleared all persisted modal state');
  }, [closeArtistModal, closeCollaborationPopup]);

  const isAnyModalOpen = showArtistModal || showCollaborationPopup;

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isAnyModalOpen) {
        event.preventDefault();
        closeAllModals();
      }
    };

    // Prevent modals from closing on tab switching and window events
    const handleVisibilityChange = (event: Event) => {
      if (isAnyModalOpen) {
        // Prevent automatic closing when tab becomes hidden/visible
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (isAnyModalOpen) {
        event.preventDefault();
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (isAnyModalOpen) {
        event.preventDefault();
      }
    };

    const handleWindowBlur = (event: FocusEvent) => {
      if (isAnyModalOpen) {
        // Prevent automatic closing when window loses focus
        event.preventDefault();
      }
    };

    const handleWindowFocus = (event: FocusEvent) => {
      if (isAnyModalOpen) {
        // Prevent automatic closing when window regains focus
        event.preventDefault();
      }
    };

    if (isAnyModalOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('pageshow', handlePageShow);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen, closeAllModals]);

  return {
    // State
    showArtistModal,
    selectedArtistName,
    showCollaborationPopup,
    collaborationArtist,
    collaborationCollaborator,
    mainArtistName,
    
    // Actions
    openArtistModal,
    closeArtistModal,
    openCollaborationPopup,
    closeCollaborationPopup,
    handleArtistSelection,
    closeAllModals,
    isAnyModalOpen,
  };
}