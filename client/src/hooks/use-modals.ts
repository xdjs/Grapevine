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

// Global modal state to persist across tab switches
declare global {
  interface Window {
    grapevineModalState?: ModalState;
  }
}

/**
 * Custom hook for managing modal states and interactions
 * Handles artist selection modal and collaboration details popup
 */
export function useModals({ 
  musicNerdBaseUrl, 
  onArtistSelection 
}: UseModalsProps = {}): ModalState & ModalActions {
  
  // Initialize from global state if available
  const getInitialState = () => {
    if (typeof window !== 'undefined' && window.grapevineModalState) {
      console.log('🔧 [Modal] Restoring from global state:', window.grapevineModalState);
      return window.grapevineModalState;
    }
    return {
      showArtistModal: false,
      selectedArtistName: '',
      showCollaborationPopup: false,
      collaborationArtist: '',
      collaborationCollaborator: '',
      mainArtistName: ''
    };
  };

  const initialState = getInitialState();
  
  // Artist Selection Modal State
  const [showArtistModal, setShowArtistModal] = useState(initialState.showArtistModal);
  const [selectedArtistName, setSelectedArtistName] = useState(initialState.selectedArtistName);
  
  // Collaboration Details Popup State
  const [showCollaborationPopup, setShowCollaborationPopup] = useState(initialState.showCollaborationPopup);
  const [collaborationArtist, setCollaborationArtist] = useState(initialState.collaborationArtist);
  const [collaborationCollaborator, setCollaborationCollaborator] = useState(initialState.collaborationCollaborator);
  const [mainArtistName, setMainArtistName] = useState(initialState.mainArtistName);

  // Update global state whenever modal state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.grapevineModalState = {
        showArtistModal,
        selectedArtistName,
        showCollaborationPopup,
        collaborationArtist,
        collaborationCollaborator,
        mainArtistName
      };
      
      console.log('🔧 [Modal] Updated global state:', window.grapevineModalState);
    }
  }, [showArtistModal, selectedArtistName, showCollaborationPopup, collaborationArtist, collaborationCollaborator, mainArtistName]);

  // Artist Modal Actions
  const openArtistModal = useCallback((artistName: string) => {
    setSelectedArtistName(artistName);
    setShowArtistModal(true);
  }, []);

  const closeArtistModal = useCallback(() => {
    setShowArtistModal(false);
    setSelectedArtistName('');
    // Clean up persisted state when deliberately closing
    if (typeof window !== 'undefined') {
      window.grapevineModalState = {
        ...window.grapevineModalState,
        showArtistModal: false,
        selectedArtistName: ''
      };
      if (!window.grapevineModalState.showCollaborationPopup) {
        delete window.grapevineModalState;
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
    if (typeof window !== 'undefined') {
      window.grapevineModalState = {
        ...window.grapevineModalState,
        showCollaborationPopup: false,
        collaborationArtist: '',
        collaborationCollaborator: '',
        mainArtistName: ''
      };
      if (!window.grapevineModalState.showArtistModal) {
        delete window.grapevineModalState;
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
    if (typeof window !== 'undefined') {
      delete window.grapevineModalState;
    }
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